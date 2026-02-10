/**
 * 3단계: 다음 카페 백필 크롤링
 * 5개 학원 × 11개 키워드 × 1개 다음카페 소스 (공무원시험)
 * HTTP(axios + cheerio) 기반, Kakao API fallback
 *
 * 실행 방법:
 *   docker exec academyinsight-backend node server/scripts/backfillDaumCafe.js
 *   또는 로컬: node server/scripts/backfillDaumCafe.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Academy = require('../models/Academy');
const CrawlSource = require('../models/CrawlSource');
const CrawlJob = require('../models/CrawlJob');
const Post = require('../models/Post');
const CrawlerFactory = require('../services/crawlers/CrawlerFactory');

// 설정
const MAX_RESULTS = 20;
const REQUEST_DELAY_MS = 2000; // 요청 간 딜레이

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 게시글 저장 (샘플 데이터 제외, 중복 방지)
 */
async function savePost(postData, sourceId, academyId) {
  // 샘플 데이터 저장하지 않음
  if (postData.isSample) return 'skipped_sample';

  try {
    const postUrl = postData.url || `daum_${postData.title}_${postData.postedAt}`;
    const existing = await Post.findOne({ postUrl });

    if (existing) {
      if (postData.viewCount > existing.viewCount || postData.commentCount > existing.commentCount) {
        existing.viewCount = Math.max(existing.viewCount, postData.viewCount || 0);
        existing.commentCount = Math.max(existing.commentCount, postData.commentCount || 0);
        await existing.save();
        return 'updated';
      }
      return 'duplicate';
    }

    await Post.create({
      source: sourceId,
      academy: academyId,
      keyword: postData.keyword,
      title: postData.title,
      content: postData.content || '',
      author: postData.author || '알 수 없음',
      postUrl,
      viewCount: postData.viewCount || 0,
      commentCount: postData.commentCount || 0,
      postedAt: postData.postedAtDate || null,
      collectedAt: new Date(),
      sourceType: 'daum_cafe',
      isSample: false
    });

    return 'saved';
  } catch (error) {
    if (error.code === 11000) return 'duplicate';
    console.error('    저장 오류:', error.message);
    return 'error';
  }
}

async function backfillDaumCafe() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/academyinsight';

  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB 연결 성공: ${mongoUri.replace(/\/\/.*@/, '//*****@')}`);
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    process.exit(1);
  }

  const academies = await Academy.find({ isActive: true }).sort({ name: 1 });
  const daumSources = await CrawlSource.find({ sourceType: 'daum_cafe', isActive: true });

  if (academies.length === 0) {
    console.error('활성화된 학원이 없습니다.');
    await mongoose.disconnect();
    process.exit(1);
  }
  if (daumSources.length === 0) {
    console.error('활성화된 다음카페 소스가 없습니다.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const totalKeywords = academies.reduce((sum, a) => sum + a.keywords.length, 0);
  const totalJobs = totalKeywords * daumSources.length;

  console.log('\n========================================');
  console.log('  3단계: 다음 카페 백필 크롤링');
  console.log('========================================');
  console.log(`학원: ${academies.map(a => a.name).join(', ')}`);
  console.log(`소스: ${daumSources.map(s => `${s.name}(${s.sourceId})`).join(', ')}`);
  console.log(`키워드당 최대: ${MAX_RESULTS}건`);
  console.log(`총 작업 수: ${totalJobs}건 (${totalKeywords} 키워드 × ${daumSources.length} 소스)`);
  console.log(`※ HTTP 기반 (axios + cheerio) - 샘플 데이터 없음`);
  console.log('========================================\n');

  const allResults = [];
  let jobCount = 0;
  const startTime = Date.now();

  for (const source of daumSources) {
    let crawler = null;

    try {
      crawler = CrawlerFactory.create(source.sourceType, source.url);

      for (const academy of academies) {
        console.log(`\n--- ${academy.name} (${academy.keywords.join(', ')}) ---`);

        for (const keyword of academy.keywords) {
          jobCount++;
          const progress = `[${jobCount}/${totalJobs}]`;
          console.log(`${progress} ${academy.name} | "${keyword}" | ${source.name}`);

          const job = await CrawlJob.create({
            source: source._id,
            academy: academy._id,
            keyword,
            status: 'running',
            startedAt: new Date()
          });

          try {
            const posts = await crawler.searchPosts(keyword, MAX_RESULTS);

            // 샘플 데이터와 실제 데이터 분리
            const realPosts = posts.filter(p => !p.isSample);
            const samplePosts = posts.filter(p => p.isSample);

            job.postsFound = realPosts.length;

            let saved = 0, duplicates = 0;
            for (const post of realPosts) {
              const result = await savePost(post, source._id, academy._id);
              if (result === 'saved') saved++;
              else if (result === 'duplicate' || result === 'updated') duplicates++;
            }

            job.postsSaved = saved;
            job.duplicatesSkipped = duplicates;
            job.status = 'completed';
            job.completedAt = new Date();
            await job.save();

            allResults.push({
              academy: academy.name,
              keyword,
              source: source.name,
              status: 'completed',
              found: realPosts.length,
              saved,
              duplicates,
              samplesSkipped: samplePosts.length
            });

            const sampleNote = samplePosts.length > 0 ? ` (샘플 ${samplePosts.length}건 제외)` : '';
            console.log(`  => found=${realPosts.length}, saved=${saved}, dup=${duplicates}${sampleNote}`);

          } catch (error) {
            job.status = 'failed';
            job.error = error.message;
            job.completedAt = new Date();
            await job.save();

            allResults.push({
              academy: academy.name,
              keyword,
              source: source.name,
              status: 'failed',
              found: 0,
              saved: 0,
              duplicates: 0,
              samplesSkipped: 0,
              error: error.message
            });

            console.log(`  => FAILED: ${error.message}`);
          }

          await delay(REQUEST_DELAY_MS);
        }
      }

    } catch (error) {
      console.error(`크롤러 초기화 실패 (${source.name}):`, error.message);
    } finally {
      if (crawler && typeof crawler.close === 'function') {
        try { await crawler.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 결과 요약
  console.log('\n========================================');
  console.log('  크롤링 결과 요약');
  console.log('========================================');

  const completed = allResults.filter(r => r.status === 'completed');
  const failed = allResults.filter(r => r.status !== 'completed');
  const totalSaved = allResults.reduce((sum, r) => sum + r.saved, 0);
  const totalFound = allResults.reduce((sum, r) => sum + r.found, 0);
  const totalDuplicates = allResults.reduce((sum, r) => sum + r.duplicates, 0);
  const totalSamples = allResults.reduce((sum, r) => sum + (r.samplesSkipped || 0), 0);

  console.log(`소요 시간: ${elapsed}초`);
  console.log(`전체 작업: ${allResults.length}건 (성공: ${completed.length}, 실패: ${failed.length})`);
  console.log(`발견 게시글: ${totalFound}건 (실제)`);
  console.log(`저장된 게시글: ${totalSaved}건 (신규)`);
  console.log(`중복 스킵: ${totalDuplicates}건`);
  if (totalSamples > 0) {
    console.log(`샘플 제외: ${totalSamples}건`);
  }

  // 학원별 요약
  console.log('\n[학원별 수집 결과]');
  for (const academy of academies) {
    const results = allResults.filter(r => r.academy === academy.name);
    const saved = results.reduce((sum, r) => sum + r.saved, 0);
    const found = results.reduce((sum, r) => sum + r.found, 0);
    console.log(`  ${academy.name}: ${found}건 발견 → ${saved}건 저장`);
  }

  if (failed.length > 0) {
    console.log('\n[실패 작업]');
    for (const f of failed) {
      console.log(`  ${f.academy} | "${f.keyword}" | ${f.source}: ${f.error}`);
    }
  }

  console.log('\n========================================');
  console.log('  백필 완료');
  console.log('========================================\n');

  await mongoose.disconnect();
  console.log('MongoDB 연결 종료');
}

backfillDaumCafe().catch(error => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
