# RESOLUTION — AI render_* presentation 위젯 렌더

> 리뷰 세션: `review/code/2026/06/25/23_13_38` (대상 `26e9863f`).
> fix 결과: `1db58757` (W2·W3 + INFO 보강을 impl 커밋에 amend, author-date 23:13:28 보존 → 리뷰 세션 postdate, review_guard 유효).
> 처분 주체: main(developer). Critical 0 + WARNING 3(전부 비차단) → resolution-applier 대신 직접 처리.

## 검증/빌드 게이트
- lint PASS / build PASS / web-chat vitest **212 passed**(리뷰-fix 테스트 +5 포함).
- 전체 unit 스테이지의 유일 실패는 frontend `spec-link-integrity.test.ts` **5000ms 타임아웃**(findBrokenLinks 전수 스캔 5736ms) — 본 diff 는 spec/docs 0개 변경(channel-web-chat 한정)이라 입력 불변 → **기존 env-perf 실패, 본 변경 무관**. CI(빠른 환경)에서 통과.
- e2e: docker.io egress 차단 환경(직전 PR 들에서 검증) — CI 에서 실행.

## WARNING

### W1 (보안, XSS) — 완화됨(오탐)
`toTemplate` 가 rendered/content 를 raw 반환 → XSS 우려. 그러나 소비처 `TemplateView`(`presentations.tsx:454-466`)는
`renderTemplateHtml(rendered, outputFormat)` = **DOMPurify(safe-html) sanitize** 거친 `safeHtml` 만
`dangerouslySetInnerHTML` 에 사용한다(script/이벤트핸들러/`javascript:` 제거). 내 `content` fallback 도 동일 `rendered`
변수를 통해 **같은 sanitize 경로**를 탄다 → 신규 XSS 표면 없음. 리뷰어가 sanitize 레이어 미추적한 오탐.

### W2 (보안, asEnvelope dual-exposure) — FIXED(방어)
실제 취약점은 아님(converter 가 알려진 필드만 읽고 asButtons/asArray 가 정규화). 단 config/output 이 동일 참조
공유하던 aliasing 을 끊기 위해 **shallow-copy** 적용: `{ config: { ...payload }, output: { ...payload } }` (+ JSDoc 명시). I-5 동시 해소.

### W3 (유지보수, toTable/toChart 단일 it) — FIXED
두 개의 it 으로 분리(`toTable`/`toChart`), 각각 truncated·title·축라벨 단언 추가(I-7/I-8).

## INFO 처분

### FIXED (테스트)
- I-9 버튼 병합 순서 `toEqual(["구매하기","자세히 보기"])`.
- I-10 노드 카루셀 envelope 의 `config.itemButtons` 병합 회귀 테스트(converters 회귀 describe 신설).
- I-11 rendered/content 동시 존재 시 rendered 우선.
- I-13 `payload:null` → null.
- I-14 `type:'form'` → null(presentations[] 비대상 명시).
- I-4 픽스처 toolCallId/renderedAt 가상값 치환.

### FIXED (문서)
- I-15 asEnvelope JSDoc(shallow 사본, aliasing 방지) / I-19 toTemplate JSDoc(content fallback) / I-20 모듈 상단 주석(두 shape + asEnvelope) / I-21 PRESENTATION_KINDS 주석.

### 비이슈(검증)
- I-6/I-24 노드 template handler 는 `output.rendered` 필드 사용(`{rendered}`) → `output.content` 부재 → fallback 무해(동작 변화 없음).
- I-23 itemButtons static 병합은 AI 경로 의도 동작(standalone static 은 itemButtons 미설정이 정상 패턴).

### DEFER (사유)
- **I-1 SPEC-DRIFT**(content→rendered 매핑 spec 명시): 코드는 백엔드 render-tool-provider(content 필수)와 정합·정확.
  spec 본문에 매핑 1행 추가는 spec-doc 후속(spec 변경=별 영역, 본 버그수정 PR 범위 외). 무해.
- **I-2 isSafeUrl URL-encode 우회 / I-3 asButtons style allowlist**: 둘 다 **본 PR 이전부터 존재한 코드**의 보안 하드닝
  제안 — 본 변경(presentation shape 정규화)과 무관. 별도 하드닝 백로그.
- I-12 presentations.test.tsx 컴포넌트 통합 테스트: plan "가능 시" 항목. 단위(classify/to* 4종) 커버 충분 → 후속.
- I-16~I-18/I-22 경미(중복 asRecord·named type 복원·describe 위치·plan 완료표기).

## 종합
Critical 0. WARNING 3 전부 비차단(W1 완화·오탐, W2/W3 fixed). spec 변경 없는 버그수정(위젯이 기존 spec 계약 충족). 머지 가능.
