const axios = require('axios');
const cheerio = require('cheerio');

class DaumCafeCrawler {
  /**
   * @param {string} cafeUrl - 카페 URL (예: https://cafe.daum.net/gongdream)
   * @param {object} options - { kakaoApiKey } 카카오 REST API 키 (선택)
   */
  constructor(cafeUrl, options = {}) {
    this.cafeUrl = cafeUrl;
    this.cafeId = this.extractCafeId(cafeUrl);
    this.kakaoApiKey = options.kakaoApiKey || process.env.KAKAO_REST_API_KEY;
  }

  /**
   * 카페 ID 추출 (URL에서)
   */
  extractCafeId(url) {
    if (!url) return '';
    const match = url.match(/cafe\.daum\.net\/([^/?]+)/);
    return match ? match[1] : '';
  }

  /**
   * 키워드로 게시글 검색
   * 1순위: 모바일 카페 내부 검색 (HTTP)
   * 2순위: Kakao Search API (API 키가 있을 때만)
   * 모두 실패 시 빈 배열 반환
   */
  async searchPosts(keyword, maxResults = 20, options = {}) {
    try {
      console.log(`[DaumCafeCrawler] Searching for keyword: "${keyword}" in ${this.cafeUrl}`);

      // 방법 1: 모바일 카페 내부 검색 (HTTP GET + cheerio)
      let posts = await this.searchPostsHttp(keyword, maxResults, options);
      if (posts.length > 0) {
        console.log(`[DaumCafeCrawler] Found ${posts.length} posts via mobile HTTP search`);
        return posts;
      }

      // 방법 2: Kakao Search API (API 키가 있을 때만)
      if (this.kakaoApiKey) {
        console.log('[DaumCafeCrawler] HTTP search returned 0, trying Kakao API...');
        posts = await this.searchPostsKakaoApi(keyword, maxResults, options);
        if (posts.length > 0) {
          console.log(`[DaumCafeCrawler] Found ${posts.length} posts via Kakao API`);
          return posts;
        }
      }

      console.log('[DaumCafeCrawler] All methods returned 0 results');
      return [];

    } catch (error) {
      console.error('[DaumCafeCrawler] Error during crawling:', error.message);
      return [];
    }
  }

  /**
   * 방법 1: 모바일 카페 내부 검색 (HTTP GET + cheerio)
   * URL: https://m.cafe.daum.net/{cafeId}/search/all?query={keyword}&sort=0&page={page}
   */
  async searchPostsHttp(keyword, maxResults, options) {
    const posts = [];
    const maxPages = 5;

    try {
      for (let page = 1; page <= maxPages; page++) {
        if (posts.length >= maxResults) break;

        const url = `https://m.cafe.daum.net/${this.cafeId}/search/all?query=${encodeURIComponent(keyword)}&sort=0&page=${page}`;
        console.log(`[DaumCafeCrawler] HTTP GET: ${url}`);

        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeout: 15000
        });

        const $ = cheerio.load(response.data);
        const items = $('#slideArticleList li');

        if (items.length === 0) {
          console.log(`[DaumCafeCrawler] Page ${page}: no results, stopping pagination`);
          break;
        }

        items.each((index, element) => {
          if (posts.length >= maxResults) return false;

          const $el = $(element);
          const linkEl = $el.find('a.link_cafe').first();
          const href = linkEl.attr('href') || '';
          const title = $el.find('.tit_info').text().trim();
          const description = $el.find('.desc_info').text().trim();
          const author = $el.find('.username').text().trim() || '알 수 없음';
          const dateStr = $el.find('.created_at').text().trim();
          const viewCountStr = $el.find('.view_count').text().trim();
          const commentCountStr = $el.find('.comments').text().trim();

          if (title && title.length > 1) {
            const postDate = this.parseDate(dateStr);
            if (this.isWithinDateRange(postDate, options.startDate, options.endDate)) {
              const fullUrl = href.startsWith('http') ? href : (href ? `https://m.cafe.daum.net${href}` : '');
              posts.push({
                title,
                url: fullUrl,
                author,
                content: description,
                postedAt: dateStr,
                postedAtDate: postDate,
                viewCount: this.parseNumber(viewCountStr),
                commentCount: this.parseNumber(commentCountStr),
                keyword,
                source: 'daum_cafe',
                cafeUrl: this.cafeUrl,
                collectedAt: new Date().toISOString(),
                isSample: false
              });
            }
          }
        });

        console.log(`[DaumCafeCrawler] Page ${page}: parsed ${items.length} items, total ${posts.length} posts`);

        // 요청 간 딜레이 (1~2초)
        if (page < maxPages && posts.length < maxResults) {
          await this.delay(1000 + Math.random() * 1000);
        }
      }
    } catch (error) {
      console.error('[DaumCafeCrawler] HTTP search error:', error.message);
    }

    return posts;
  }

  /**
   * 방법 2: Kakao Search API
   * URL: GET https://dapi.kakao.com/v2/search/cafe?query={keyword}&sort=recency&page={page}&size=50
   */
  async searchPostsKakaoApi(keyword, maxResults, options) {
    const posts = [];
    const maxPages = 5;
    const pageSize = Math.min(50, maxResults);

    try {
      for (let page = 1; page <= maxPages; page++) {
        if (posts.length >= maxResults) break;

        const response = await axios.get('https://dapi.kakao.com/v2/search/cafe', {
          params: {
            query: keyword,
            sort: 'recency',
            page,
            size: pageSize
          },
          headers: {
            'Authorization': `KakaoAK ${this.kakaoApiKey}`
          },
          timeout: 10000
        });

        const documents = response.data.documents;
        if (!documents || documents.length === 0) break;

        for (const doc of documents) {
          if (posts.length >= maxResults) break;

          // 카페 ID 필터링: cafeId가 있으면 해당 카페 게시글만 수집
          if (this.cafeId && doc.url) {
            if (!doc.url.includes('cafe.daum.net') && !doc.url.includes(this.cafeId)) {
              continue;
            }
          }

          const title = this.stripHtml(doc.title);
          const content = this.stripHtml(doc.contents);
          const postDate = doc.datetime ? new Date(doc.datetime) : null;

          if (this.isWithinDateRange(postDate, options.startDate, options.endDate)) {
            posts.push({
              title,
              url: doc.url || '',
              author: '알 수 없음',
              content,
              postedAt: postDate ? postDate.toISOString().split('T')[0] : '',
              postedAtDate: postDate,
              viewCount: 0,
              commentCount: 0,
              keyword,
              source: 'daum_cafe',
              cafeUrl: doc.cafename || this.cafeUrl,
              collectedAt: new Date().toISOString(),
              isSample: false
            });
          }
        }

        // 마지막 페이지 확인
        if (response.data.meta && response.data.meta.is_end) break;
        if (documents.length < pageSize) break;

        await this.delay(100);
      }
    } catch (error) {
      if (error.response) {
        console.error(`[DaumCafeCrawler] Kakao API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        console.error(`[DaumCafeCrawler] Kakao API error: ${error.message}`);
      }
    }

    return posts;
  }

  /**
   * HTML 태그 제거
   */
  stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * 숫자 파싱
   */
  parseNumber(str) {
    if (!str) return 0;
    const cleaned = str.replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }

  /**
   * 날짜 파싱 (한국어 날짜 형식 지원)
   */
  parseDate(dateStr) {
    if (!dateStr) return null;

    const today = new Date();
    const currentYear = today.getFullYear();

    // "2025.10.15" 형식 (4자리 연도)
    const fullDateMatch = dateStr.match(/(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
    if (fullDateMatch) {
      const [, year, month, day] = fullDateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // "26.02.09" 형식 (2자리 연도)
    const shortYearMatch = dateStr.match(/(\d{2})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
    if (shortYearMatch) {
      const [, shortYear, month, day] = shortYearMatch;
      return new Date(2000 + parseInt(shortYear), parseInt(month) - 1, parseInt(day));
    }

    // "10.15" 또는 "10.15." 형식 (올해)
    const shortDateMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
    if (shortDateMatch) {
      const [, month, day] = shortDateMatch;
      return new Date(currentYear, parseInt(month) - 1, parseInt(day));
    }

    // "어제"
    if (dateStr.includes('어제')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // "N시간 전"
    const hoursMatch = dateStr.match(/(\d+)\s*시간\s*전/);
    if (hoursMatch) {
      const date = new Date(today);
      date.setHours(date.getHours() - parseInt(hoursMatch[1]));
      return date;
    }

    // "N분 전"
    const minutesMatch = dateStr.match(/(\d+)\s*분\s*전/);
    if (minutesMatch) {
      const date = new Date(today);
      date.setMinutes(date.getMinutes() - parseInt(minutesMatch[1]));
      return date;
    }

    // "N일 전"
    const daysMatch = dateStr.match(/(\d+)\s*일\s*전/);
    if (daysMatch) {
      const date = new Date(today);
      date.setDate(date.getDate() - parseInt(daysMatch[1]));
      return date;
    }

    return null;
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
   * close() - HTTP 기반이므로 정리할 리소스 없음 (인터페이스 호환용)
   */
  async close() {
    // No browser to close - HTTP based crawler
  }

  /**
   * 딜레이
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DaumCafeCrawler;
