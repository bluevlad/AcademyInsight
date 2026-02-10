const NaverCafeCrawler = require('./NaverCafeCrawler');
const DaumCafeCrawler = require('./DaumCafeCrawler');
const DCInsideCrawler = require('./DCInsideCrawler');

class CrawlerFactory {
  /**
   * sourceType에 따라 적절한 크롤러 인스턴스 생성
   * @param {string} sourceType - 'naver_cafe', 'daum_cafe', 'dcinside'
   * @param {string} sourceUrl - 크롤링 대상 URL
   * @param {object} options - 추가 옵션 (credentials 등)
   * @returns {BaseCrawler} 크롤러 인스턴스
   */
  static create(sourceType, sourceUrl, options = {}) {
    switch (sourceType) {
      case 'naver_cafe':
        return new NaverCafeCrawler(sourceUrl, {
          clientId: process.env.NAVER_CLIENT_ID,
          clientSecret: process.env.NAVER_CLIENT_SECRET
        });

      case 'daum_cafe':
        return new DaumCafeCrawler(sourceUrl, {
          kakaoApiKey: process.env.KAKAO_REST_API_KEY,
          ...options
        });

      case 'dcinside':
        return new DCInsideCrawler(sourceUrl, options);

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }
}

module.exports = CrawlerFactory;
