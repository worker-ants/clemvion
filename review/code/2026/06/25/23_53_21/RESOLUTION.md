# RESOLUTION — 설치 스니펫 command-queue 스텁

> 리뷰 세션: `review/code/2026/06/25/23_53_21` (대상 `ed31b821`).
> fix 결과: `09afad6f` (W1·I3·I4·I6 fix 를 impl 커밋에 amend, author-date 23:53:07 보존 → 리뷰 세션 postdate, review_guard 유효).
> 처분 주체: main(developer). Critical 0 + WARNING 1(FIXED) → 직접 처리.

## 검증/빌드 게이트
- lint PASS / build PASS / frontend vitest **4744 passed**(스니펫 스텁·순서 테스트 포함, spec-link-integrity 도 통과).
- `§1.4` dangling 참조 0 확인(grep).

## WARNING

### W1 (Testing, indexOf 순서검증 취약) — FIXED
`snippet.test.ts` 의 `indexOf("window.ClemvionChat.q")` 단일 substring 순서 검증을 **`snippet.split("</script>")`
블록 분리 + `QUEUE_STUB_JS` 상수 매칭** 으로 교체 — 스텁 블록이 boot 블록보다 앞임을 구조적으로 검증(향후 `.q`
다중 참조에도 false-negative 없음).

## INFO 처분

### FIXED
- **I-4(핵심)**: 동일 큐 스텁 리터럴이 6곳 복사 → `snippet.ts` 에 **`QUEUE_STUB_JS` 상수 추출·export**, 테스트가
  상수 직접 참조. 코드↔테스트 자동 동기화로 재drift 위험 감소(마크다운 예시 4종은 가독성용 줄분리라 별 포맷이나
  QUEUE_STUB_JS JSDoc 에 동기화 의무 명시).
- **I-3**: 테스트 검색 토큰을 모호한 `.q=` 대신 `QUEUE_STUB_JS` 상수로 명확화.
- **I-6**: spec/snippet/plan 의 `§1.4` 참조가 **dangling**(2-sdk 에 §1.4 서브섹션 부재 — 명령 큐는 §1 본문) →
  `§1`·`R5` 로 정정. grep 으로 잔여 0 확인.

### 비이슈/수용
- I-1/I-2(snippet.ts 한 줄 vs MDX 줄분리 포맷): 마크다운 예시는 가독성용 별 포맷이 정상. QUEUE_STUB_JS JSDoc 에
  "스니펫·spec·가이드 동일 스텁 공유, 형식 변경 시 함께 갱신" 명시로 동기화 의무 명문화.
- I-8(triggerEndpointPath 공개)·I-9(CSP 인라인 script): **기존 아키텍처 결정**, 본 스텁 추가와 무관.

### DEFER
- I-5(`data-global` 재지정 시 스텁 전역명 하드코딩 연동): 별 이슈/plan 추적(고급 케이스, 기본 스니펫은 `ClemvionChat`).
- I-7(`WebChatBootInput.profile` 누락): channel-web-chat-followups 기존 known-gap, 본 PR 범위 외.
- I-10(MDX↔buildWebChatSnippet snapshot 동기화 테스트): 후속(낮은 우선순위).
- I-11(`loaderUrl` escapeForScript 테스트): 서버 생성값으로 저위험, 방어적 커버리지 후속.

### documentation reviewer 미생성
output 파일 부재(재시도 필요). 문서 변경(MDX 4파일)은 **코드블록 내 스텁 한 줄 추가**뿐(링크·frontmatter 불변)이라
`user_guide_sync`(NONE — 매트릭스 매칭 0, KO/EN 대칭 갱신 확인) + 본 SUMMARY 로 커버. 별도 재실행 불요.

## 종합
Critical 0, WARNING 1(FIXED). 버그(스니펫 큐 스텁 누락) 6곳 일관 수정 + QUEUE_STUB_JS 상수화로 재drift 예방 + R5 Rationale. 머지 가능.
