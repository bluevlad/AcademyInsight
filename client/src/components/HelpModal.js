import React from 'react';
import './HelpModal.css';

const HelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target.className === 'help-modal-overlay') {
      onClose();
    }
  };

  return (
    <div className="help-modal-overlay" onClick={handleOverlayClick}>
      <div className="help-modal">
        <button className="help-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="help-modal-header">
          <h2>AcademyInsight 사용 가이드</h2>
          <p className="help-subtitle">학원 강사를 위한 온라인 평판 모니터링 시스템</p>
        </div>

        <div className="help-modal-content">
          {/* 서비스 소개 */}
          <section className="help-section">
            <h3>서비스 소개</h3>
            <p>
              AcademyInsight는 네이버 카페 등 주요 커뮤니티에서 특정 키워드(강사명, 학원명 등)가
              포함된 게시글을 자동으로 수집하고 분석하여 여론 현황을 파악할 수 있는 서비스입니다.
            </p>
          </section>

          {/* 주요 기능 */}
          <section className="help-section">
            <h3>주요 기능</h3>
            <div className="feature-list">
              <div className="feature-item">
                <span className="feature-icon">🔍</span>
                <div>
                  <strong>키워드 검색</strong>
                  <p>지정된 키워드로 카페 게시글을 자동 수집합니다.</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <div>
                  <strong>통계 분석</strong>
                  <p>월별 게시글 수, 조회수, 댓글 수 등 통계를 제공합니다.</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📅</span>
                <div>
                  <strong>기간 필터</strong>
                  <p>원하는 기간의 게시글만 선별하여 분석합니다.</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔗</span>
                <div>
                  <strong>원문 링크</strong>
                  <p>게시글 제목 클릭 시 원본 게시글로 이동합니다.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 사용 방법 */}
          <section className="help-section">
            <h3>사용 방법</h3>
            <ol className="usage-steps">
              <li>
                <strong>데이터 수집 버튼 클릭</strong>
                <p>화면 상단의 "데이터 수집하기" 버튼을 클릭합니다.</p>
              </li>
              <li>
                <strong>수집 완료 대기</strong>
                <p>게시글 수집에는 약 30초~1분 정도 소요됩니다.</p>
              </li>
              <li>
                <strong>통계 확인</strong>
                <p>수집 완료 후 통계 요약과 게시글 목록을 확인합니다.</p>
              </li>
              <li>
                <strong>게시글 상세 보기</strong>
                <p>관심있는 게시글 제목을 클릭하면 원본으로 이동합니다.</p>
              </li>
            </ol>
          </section>

          {/* 네이버 로그인 안내 */}
          <section className="help-section">
            <h3>네이버 로그인 사용 (선택)</h3>
            <div className="info-box">
              <p>
                <strong>왜 로그인이 필요한가요?</strong>
              </p>
              <p>
                일부 카페는 회원만 게시글을 볼 수 있습니다.
                네이버 로그인을 사용하면 더 많은 게시글을 수집할 수 있습니다.
              </p>
              <div className="warning-box">
                <strong>주의사항</strong>
                <ul>
                  <li>로그인 정보는 서버에 저장되지 않습니다.</li>
                  <li>2단계 인증이 설정된 계정은 사용이 어렵습니다.</li>
                  <li>캡차가 나타나면 수집이 실패할 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="help-section">
            <h3>자주 묻는 질문 (FAQ)</h3>
            <div className="faq-list">
              <details className="faq-item">
                <summary>게시글이 수집되지 않아요</summary>
                <p>
                  네이버 카페의 접근 제한으로 인해 일부 게시글이 수집되지 않을 수 있습니다.
                  "네이버 로그인 사용하기" 옵션을 활성화해 보세요.
                </p>
              </details>
              <details className="faq-item">
                <summary>샘플 데이터가 표시돼요</summary>
                <p>
                  실제 크롤링이 실패한 경우 테스트용 샘플 데이터가 표시됩니다.
                  이는 시스템이 정상 작동하는지 확인하기 위한 것입니다.
                </p>
              </details>
              <details className="faq-item">
                <summary>다른 카페도 검색할 수 있나요?</summary>
                <p>
                  현재는 지정된 카페(독공사)만 지원합니다.
                  추후 업데이트를 통해 다양한 카페 지원이 추가될 예정입니다.
                </p>
              </details>
              <details className="faq-item">
                <summary>모바일에서도 사용할 수 있나요?</summary>
                <p>
                  네, 모바일 브라우저에서도 사용 가능합니다.
                  반응형 디자인으로 화면 크기에 맞게 자동 조정됩니다.
                </p>
              </details>
            </div>
          </section>

          {/* 문의 */}
          <section className="help-section contact-section">
            <h3>문의 및 피드백</h3>
            <p>
              서비스 이용 중 문제가 발생하거나 개선 의견이 있으시면
              관리자에게 문의해 주세요.
            </p>
          </section>
        </div>

        <div className="help-modal-footer">
          <button className="help-modal-close-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
