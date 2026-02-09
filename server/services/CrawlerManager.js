const CrawlerFactory = require('./crawlers/CrawlerFactory');
const Academy = require('../models/Academy');
const CrawlSource = require('../models/CrawlSource');
const Post = require('../models/Post');
const CrawlJob = require('../models/CrawlJob');

class CrawlerManager {
  /**
   * 단일 크롤 작업 실행
   */
  async executeCrawlJob(crawlSource, keyword, academyId, options = {}) {
    const job = await CrawlJob.create({
      source: crawlSource._id,
      academy: academyId,
      keyword,
      status: 'running',
      startedAt: new Date()
    });

    let crawler = null;

    try {
      console.log(`[CrawlerManager] Starting job ${job._id}: ${crawlSource.name} / ${keyword}`);

      crawler = CrawlerFactory.create(crawlSource.sourceType, crawlSource.url, {
        credentials: options.credentials
      });

      const posts = await crawler.searchPosts(keyword, options.maxResults || 20, {
        startDate: options.startDate,
        endDate: options.endDate
      });

      job.postsFound = posts.length;

      // 게시글 저장
      let saved = 0;
      let duplicates = 0;

      for (const postData of posts) {
        const result = await this.savePost(postData, crawlSource._id, academyId);
        if (result === 'saved') saved++;
        else if (result === 'duplicate') duplicates++;
      }

      job.postsSaved = saved;
      job.duplicatesSkipped = duplicates;
      job.status = 'completed';
      job.completedAt = new Date();
      await job.save();

      // 소스의 마지막 크롤링 시간 업데이트
      await CrawlSource.findByIdAndUpdate(crawlSource._id, { lastCrawledAt: new Date() });

      console.log(`[CrawlerManager] Job ${job._id} completed: found=${posts.length}, saved=${saved}, duplicates=${duplicates}`);

      return job;

    } catch (error) {
      console.error(`[CrawlerManager] Job ${job._id} failed:`, error.message);
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      await job.save();
      return job;
    } finally {
      if (crawler) {
        await crawler.close();
      }
    }
  }

  /**
   * 학원별 크롤링 (모든 키워드 x 모든 소스)
   */
  async crawlForAcademy(academyId, options = {}) {
    const academy = await Academy.findById(academyId);
    if (!academy) throw new Error('학원을 찾을 수 없습니다');
    if (!academy.isActive) throw new Error('비활성화된 학원입니다');

    const sources = await CrawlSource.find({ isActive: true });
    if (sources.length === 0) throw new Error('활성화된 크롤링 소스가 없습니다');

    const jobs = [];

    for (const keyword of academy.keywords) {
      for (const source of sources) {
        const job = await this.executeCrawlJob(source, keyword, academyId, options);
        jobs.push(job);
      }
    }

    return {
      academy: academy.name,
      totalJobs: jobs.length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      totalPostsSaved: jobs.reduce((sum, j) => sum + (j.postsSaved || 0), 0),
      jobs
    };
  }

  /**
   * 전체 학원 크롤링
   */
  async crawlAll(options = {}) {
    const academies = await Academy.find({ isActive: true });
    const results = [];

    for (const academy of academies) {
      try {
        const result = await this.crawlForAcademy(academy._id, options);
        results.push(result);
      } catch (error) {
        console.error(`[CrawlerManager] Error crawling for ${academy.name}:`, error.message);
        results.push({
          academy: academy.name,
          error: error.message
        });
      }
    }

    return {
      totalAcademies: academies.length,
      results
    };
  }

  /**
   * 게시글 저장 (postUrl 기준 upsert - 중복 방지)
   * @returns {'saved' | 'duplicate' | 'updated'}
   */
  async savePost(postData, sourceId, academyId) {
    try {
      // postUrl이 없으면 제목+날짜로 키 생성
      const postUrl = postData.url || `${postData.source}_${postData.title}_${postData.postedAt}`;

      const existing = await Post.findOne({ postUrl });

      if (existing) {
        // 기존 게시글이면 조회수/댓글수만 업데이트
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
        postedAt: postData.postedAtDate || postData.postedAt ? new Date(postData.postedAtDate || postData.postedAt) : null,
        collectedAt: new Date(),
        sourceType: postData.source,
        isSample: postData.isSample || false
      });

      return 'saved';

    } catch (error) {
      // 중복 키 에러 (동시 요청 시)
      if (error.code === 11000) {
        return 'duplicate';
      }
      console.error('[CrawlerManager] Error saving post:', error.message);
      return 'duplicate';
    }
  }
}

module.exports = new CrawlerManager();
