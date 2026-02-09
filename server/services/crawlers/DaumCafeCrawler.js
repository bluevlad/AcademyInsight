const BaseCrawler = require('./BaseCrawler');
const cheerio = require('cheerio');

class DaumCafeCrawler extends BaseCrawler {
  constructor(cafeUrl, options = {}) {
    super(options);
    this.cafeUrl = cafeUrl;
    this.cafeId = this.extractCafeId(cafeUrl);
  }

  extractCafeId(url) {
    const match = url.match(/cafe\.daum\.net\/([^/?]+)/);
    return match ? match[1] : '';
  }

  /**
   * 키워드로 게시글 검색
   */
  async searchPosts(keyword, maxResults = 10, options = {}) {
    try {
      if (!this.browser) {
        await this.initBrowser();
      }

      console.log(`[DaumCafeCrawler] Searching for keyword: ${keyword} in ${this.cafeUrl}`);

      // 방법 1: 모바일 다음카페 검색
      let posts = await this.searchPostsMobile(keyword, maxResults, options);
      if (posts.length > 0) {
        console.log(`[DaumCafeCrawler] Found ${posts.length} posts via mobile search`);
        return posts;
      }

      // 방법 2: 다음 통합 검색
      console.log('[DaumCafeCrawler] Mobile search failed, trying Daum search...');
      posts = await this.searchPostsDaumSearch(keyword, maxResults, options);
      if (posts.length > 0) {
        console.log(`[DaumCafeCrawler] Found ${posts.length} posts via Daum search`);
        return posts;
      }

      // 방법 3: 샘플 데이터
      console.log('[DaumCafeCrawler] All methods failed, generating sample data...');
      return this.generateSampleData(keyword, maxResults, options);

    } catch (error) {
      console.error('[DaumCafeCrawler] Error during crawling:', error);
      return this.generateSampleData(keyword, maxResults, options);
    }
  }

  /**
   * 모바일 다음카페 검색
   */
  async searchPostsMobile(keyword, maxResults, options) {
    try {
      await this.page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      );
      await this.page.setViewport({ width: 375, height: 812, isMobile: true });

      const searchUrl = `https://m.cafe.daum.net/${this.cafeId}/_search?query=${encodeURIComponent(keyword)}`;
      console.log(`[DaumCafeCrawler] Navigating to: ${searchUrl}`);

      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomDelay(2000, 4000);
      await this.autoScroll();

      const content = await this.page.content();
      const $ = cheerio.load(content);
      this.saveDebugHtml(content, 'daum_mobile');

      const posts = [];
      const selectors = [
        '.article_list li',
        '.search_list li',
        '[class*="article"] a',
        '.tit_article'
      ];

      for (const selector of selectors) {
        $(selector).each((index, element) => {
          if (posts.length >= maxResults) return false;
          const $el = $(element);

          const titleEl = $el.find('a.tit, .tit_article, a[class*="title"]').first();
          const title = (titleEl.text().trim() || $el.find('a').first().text().trim());
          const url = titleEl.attr('href') || $el.find('a').first().attr('href');
          const author = $el.find('.info_writer, .nickname, [class*="writer"]').text().trim() || '알 수 없음';
          const date = $el.find('.info_date, .date, [class*="date"]').text().trim();
          const viewCount = $el.find('.info_view, [class*="view"]').text().trim();
          const commentCount = $el.find('.info_comment, [class*="comment"], .num_reply').text().trim();

          if (title && title.length > 2) {
            const postDate = this.parseDate(date);
            if (this.isWithinDateRange(postDate, options.startDate, options.endDate)) {
              const fullUrl = url ? (url.startsWith('http') ? url : `https://m.cafe.daum.net${url}`) : '';
              posts.push({
                title,
                url: fullUrl,
                author,
                postedAt: date,
                postedAtDate: postDate,
                viewCount: this.parseNumber(viewCount),
                commentCount: this.parseNumber(commentCount),
                keyword,
                source: 'daum_cafe',
                cafeUrl: this.cafeUrl,
                collectedAt: new Date().toISOString()
              });
            }
          }
        });
        if (posts.length > 0) break;
      }

      // PC User-Agent 복원
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await this.page.setViewport({ width: 1920, height: 1080 });

      return posts;

    } catch (error) {
      console.error('[DaumCafeCrawler] Mobile search error:', error.message);
      return [];
    }
  }

  /**
   * 다음 통합검색 사용
   */
  async searchPostsDaumSearch(keyword, maxResults, options) {
    try {
      const searchQuery = `${keyword} site:cafe.daum.net/${this.cafeId}`;
      const searchUrl = `https://search.daum.net/search?w=cafe&q=${encodeURIComponent(searchQuery)}`;

      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomDelay(2000, 4000);

      const content = await this.page.content();
      const $ = cheerio.load(content);
      this.saveDebugHtml(content, 'daum_search');

      const posts = [];

      $('a.f_link_b, .wrap_tit a, .tit_info a').each((index, element) => {
        if (posts.length >= maxResults) return false;

        const $el = $(element);
        const title = $el.text().trim();
        const url = $el.attr('href');

        if (title && title.length > 3 && url && url.includes('cafe.daum.net')) {
          if (!posts.find(p => p.title === title)) {
            posts.push({
              title,
              url,
              author: '알 수 없음',
              postedAt: '',
              postedAtDate: null,
              viewCount: 0,
              commentCount: 0,
              keyword,
              source: 'daum_cafe',
              cafeUrl: this.cafeUrl,
              collectedAt: new Date().toISOString()
            });
          }
        }
      });

      return posts;

    } catch (error) {
      console.error('[DaumCafeCrawler] Daum search error:', error.message);
      return [];
    }
  }

  /**
   * 게시글 상세 정보 가져오기
   */
  async getPostDetail(articleUrl) {
    try {
      if (!this.browser) {
        await this.initBrowser();
      }

      console.log(`[DaumCafeCrawler] Fetching post detail: ${articleUrl}`);

      await this.page.goto(articleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomDelay(2000, 4000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      const title = $('.tit_subject, .article_title, h3.tit').text().trim();
      const author = $('.info_writer .txt_sub, .nickname').text().trim();
      const postDate = $('.info_date, .date').text().trim();
      const articleContent = $('.article_view, .contents_article, #article').html() || '';
      const viewCountStr = $('.info_view .num_count, .count_view').text().trim();

      const comments = [];
      $('.comment_list li, .list_comment li').each((index, element) => {
        const $comment = $(element);
        comments.push({
          author: $comment.find('.txt_sub, .nickname').text().trim(),
          content: $comment.find('.txt_comment, .desc').text().trim(),
          commentedAt: $comment.find('.date, .time').text().trim()
        });
      });

      return { title, author, postedAt: postDate, content: articleContent, viewCount: this.parseNumber(viewCountStr), comments, url: articleUrl };

    } catch (error) {
      console.error('[DaumCafeCrawler] Error fetching post detail:', error);
      throw error;
    }
  }

  /**
   * 샘플 데이터 생성
   */
  generateSampleData(keyword, maxResults, options) {
    console.log('[DaumCafeCrawler] Generating sample data as fallback...');
    const posts = [];
    const now = new Date();

    for (let i = 0; i < Math.min(maxResults, 10); i++) {
      const randomDays = Math.floor(Math.random() * 90);
      const postDate = new Date(now);
      postDate.setDate(postDate.getDate() - randomDays);

      if (options.startDate) {
        const startDate = new Date(options.startDate);
        if (postDate < startDate) {
          postDate.setTime(startDate.getTime() + Math.random() * (now.getTime() - startDate.getTime()));
        }
      }
      if (options.endDate) {
        const endDate = new Date(options.endDate);
        if (postDate > endDate) {
          const start = options.startDate ? new Date(options.startDate) : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
          postDate.setTime(start.getTime() + Math.random() * (endDate.getTime() - start.getTime()));
        }
      }

      const dateStr = `${postDate.getFullYear()}.${(postDate.getMonth() + 1).toString().padStart(2, '0')}.${postDate.getDate().toString().padStart(2, '0')}`;

      posts.push({
        title: `[샘플] ${keyword} 관련 다음카페 게시글 ${i + 1}`,
        url: `${this.cafeUrl}/sample${i + 1}`,
        author: '테스트사용자',
        postedAt: dateStr,
        postedAtDate: postDate,
        viewCount: Math.floor(Math.random() * 300) + 30,
        commentCount: Math.floor(Math.random() * 15),
        keyword,
        source: 'daum_cafe',
        cafeUrl: this.cafeUrl,
        collectedAt: new Date().toISOString(),
        isSample: true
      });
    }

    console.log(`[DaumCafeCrawler] Generated ${posts.length} sample posts`);
    return posts;
  }
}

module.exports = DaumCafeCrawler;
