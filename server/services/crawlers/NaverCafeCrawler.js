const axios = require('axios');

class NaverCafeCrawler {
  /**
   * @param {string} cafeUrl - 카페 URL (예: https://cafe.naver.com/m2school)
   * @param {object} apiKeys - { clientId, clientSecret } 네이버 검색 API 키
   */
  constructor(cafeUrl, apiKeys = {}) {
    this.cafeUrl = cafeUrl;
    this.cafeId = this.extractCafeId(cafeUrl);
    this.clientId = apiKeys.clientId || process.env.NAVER_CLIENT_ID;
    this.clientSecret = apiKeys.clientSecret || process.env.NAVER_CLIENT_SECRET;
  }

  /**
   * 키워드로 카페 게시글 검색 (네이버 검색 API 사용)
   */
  async searchPosts(keyword, maxResults = 20, options = {}) {
    if (!this.clientId || !this.clientSecret) {
      console.error('[NaverCafeCrawler] NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.');
      return [];
    }

    try {
      console.log(`[NaverCafeCrawler] Searching for keyword: "${keyword}" via Naver Search API`);

      const display = Math.min(maxResults, 100);
      const posts = [];
      let start = 1;
      const maxStart = 1000;

      while (posts.length < maxResults && start <= maxStart) {
        const currentDisplay = Math.min(display, maxResults - posts.length, 100);

        const response = await axios.get('https://openapi.naver.com/v1/search/cafearticle', {
          params: {
            query: keyword,
            display: currentDisplay,
            start,
            sort: 'date'
          },
          headers: {
            'X-Naver-Client-Id': this.clientId,
            'X-Naver-Client-Secret': this.clientSecret
          }
        });

        const items = response.data.items;
        if (!items || items.length === 0) break;

        for (const item of items) {
          if (posts.length >= maxResults) break;

          const post = this.parseApiItem(item, keyword);

          // 카페 ID 필터링: cafeId가 있으면 해당 카페 게시글만 수집
          if (this.cafeId && post.cafeName) {
            const itemCafeUrl = item.cafeurl || '';
            const matchesCafe = itemCafeUrl.includes(this.cafeId) ||
                                post.url.includes(this.cafeId);
            if (!matchesCafe) continue;
          }

          // 날짜 범위 필터링
          if (this.isWithinDateRange(post.postedAtDate, options.startDate, options.endDate)) {
            posts.push(post);
          }
        }

        // 다음 페이지
        start += items.length;
        if (items.length < currentDisplay) break;

        // API rate limit 방지
        await this.delay(100);
      }

      console.log(`[NaverCafeCrawler] Found ${posts.length} posts via Naver Search API`);
      return posts;

    } catch (error) {
      if (error.response) {
        console.error(`[NaverCafeCrawler] API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        console.error(`[NaverCafeCrawler] Error: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * API 응답 item을 기존 포맷으로 변환
   */
  parseApiItem(item, keyword) {
    // API 응답의 HTML 태그 제거
    const title = this.stripHtml(item.title);
    const description = this.stripHtml(item.description);

    return {
      title,
      url: item.link,
      author: '알 수 없음',
      content: description,
      postedAt: '',
      postedAtDate: null,
      viewCount: 0,
      commentCount: 0,
      keyword,
      source: 'naver_cafe',
      cafeUrl: item.cafeurl || this.cafeUrl,
      cafeName: item.cafename || '',
      collectedAt: new Date().toISOString(),
      isSample: false
    };
  }

  /**
   * HTML 태그 제거
   */
  stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * 카페 ID 추출 (URL에서)
   */
  extractCafeId(url) {
    if (!url) return '';
    const match = url.match(/cafe\.naver\.com\/([^/?]+)/);
    return match ? match[1] : '';
  }

  /**
   * 날짜 범위 체크
   */
  isWithinDateRange(postDate, startDate, endDate) {
    if (!startDate && !endDate) return true;
    if (!postDate) return true;

    const date = new Date(postDate);
    if (startDate && date < new Date(startDate)) return false;
    if (endDate && date > new Date(endDate)) return false;
    return true;
  }

  /**
   * close() - API 기반이므로 정리할 리소스 없음 (인터페이스 호환용)
   */
  async close() {
    // No browser to close - API based crawler
  }

  /**
   * 딜레이
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NaverCafeCrawler;
