# Code Review 통합 보고서

> 리뷰 세션: `review/code/2026/06/25/23_13_38` (대상 `26e9863f`). 처분: `RESOLUTION.md`.

## 전체 위험도
**MEDIUM → 실질 LOW** — Critical 0. WARNING 3건 중 W1(XSS)은 **기존 DOMPurify sanitize 로 이미 완화**(오탐), W2는 cleanliness(취약점 아님), W3은 trivial 테스트 분리. 나머지 INFO 다수는 테스트/문서 polish.

## Critical
없음.

## 경고 (WARNING) — 처분

| # | 카테고리 | 발견 | 처분 |
|---|----------|------|------|
| 1 | 보안 | `toTemplate` 가 rendered/content 를 raw 반환 → XSS 위험 | **완화됨(오탐)** — 소비처 `TemplateView`(presentations.tsx:454-466)는 `renderTemplateHtml()`=**DOMPurify(safe-html) sanitize** 거친 `safeHtml` 만 `dangerouslySetInnerHTML` 에 사용(script/이벤트핸들러/javascript: 제거). content fallback 도 동일 `rendered`→동일 sanitize 경로. 신규 XSS 표면 없음. |
| 2 | 보안 | `asEnvelope` 가 payload 를 config·output 동시 노출(aliasing) | **취약점 아님** — converter 가 알려진 필드만 읽고 asButtons/asArray 가 정규화. 단 aliasing 방어로 **shallow-copy 적용**(I-5 동시 해소). |
| 3 | 유지보수성 | toTable/toChart 단일 it 블록 | **FIXED** — 두 it 으로 분리. |

## 참고 (INFO) — 처분 요약
- **FIXED(테스트)**: I-9 버튼 병합 순서 `toEqual`, I-10 노드 카루셀 itemButtons 회귀, I-11 rendered/content 우선순위, I-13 `payload:null`, I-14 form 제외 명시, I-4 픽스처 가상 toolCallId/renderedAt.
- **FIXED(문서)**: I-15 asEnvelope JSDoc(config===output 사본), I-19 toTemplate JSDoc content fallback, I-20 모듈 상단 PresentationPayload shape, I-21 PRESENTATION_KINDS 주석.
- **비이슈(검증)**: I-6/I-24 노드 template 은 `output.rendered` 필드 사용(handler `{rendered}`) → `output.content` 부재 → fallback 무해. I-23 itemButtons static 병합은 AI 경로 의도 동작(standalone static 은 itemButtons 미설정이 정상).
- **DEFER**: I-1 SPEC-DRIFT(content→rendered 매핑 spec 명시) — 코드 정확, spec-doc 후속(spec 변경=별 영역). I-2 isSafeUrl URL-encode 우회·I-3 asButtons style allowlist = **기존 코드** 보안 하드닝(본 PR 외). I-12 presentations.test.tsx 통합 테스트(plan "가능 시" 항목, 단위 커버 충분). I-16~I-18/I-22 경미.

## 에이전트별
- security MEDIUM→LOW(W1 완화·오탐, W2 cleanliness) / requirement LOW(SPEC-DRIFT INFO) / scope NONE / side_effect LOW(aliasing→shallow-copy) / maintainability LOW(W3 fixed) / testing LOW(커버리지 추가) / documentation LOW(주석 추가).

## 권장 조치 → 처분
1. W1: 완화됨(DOMPurify) — 조치 불요.
2. W2/I-5: asEnvelope shallow-copy 적용.
3. W3: 테스트 분리.
4. I-1 SPEC-DRIFT: DEFER(코드 정확, spec-doc 후속).
5. 테스트/문서 INFO: cheap 항목 일괄 적용.
