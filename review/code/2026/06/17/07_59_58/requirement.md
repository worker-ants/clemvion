# 요구사항(Requirement) 리뷰 결과

**리뷰 대상**: deps-backlog-residual 브랜치 변경
**리뷰 일시**: 2026-06-17
**리뷰어**: requirement

---

## 발견사항

### [WARNING] `spec/7-channel-web-chat/4-security.md` §1 — refactor 태그 소문자 `m-1` 미수정

- **위치**: `spec/7-channel-web-chat/4-security.md` 라인 37, `(refactor 04 m-1)`
- **상세**: 이번 변경에서 `§1.1` 섹션 신설·`safe-html.ts` frontmatter 등재는 정상 반영됐으나, consistency-check SUMMARY W-2("`(refactor 04 m-1)` → `(refactor 04 M-1)`로 수정")는 이번 diff 에 반영되지 않았다. `spec/conventions/swagger.md §0` 및 §311 에서 동일 리팩토링 배치를 `refactor 04 M-1`(대문자 M)로 표기하므로 현재 `4-security.md` §1 의 `m-1`은 대소문자 불일치가 맞다.
- **기능 완전성 영향**: 기능 요구사항 자체가 누락된 것은 아니지만, consistency-check 가 WARNING 으로 지정한 사항이 처리되지 않았다. 검색·레이블 기반 추적 정확도에 영향.
- **제안**: `(refactor 04 m-1)` → `(refactor 04 M-1)` 로 1글자 수정.

---

### [INFO] [SPEC-DRIFT] `spec/7-channel-web-chat/4-security.md` §1 — 구현 세부(`ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP`)가 §1 요약 테이블과 §1.1 매트릭스 양쪽에 중복 기술

- **위치**: `spec/7-channel-web-chat/4-security.md` §1 테이블 `입력 sanitize` 행 및 §1.1 매트릭스
- **상세**: §1 요약 테이블에 `DOMPurify ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP` 세부가 직접 기술되고 §1.1 에도 동일 정보가 있다. 단일 진실 원칙 관점에서 이중 SoT 가 형성됐으나, 코드 구현 자체는 `safe-html.ts` 가 SoT 이고 두 위치 모두 동일 내용을 옳게 기술하고 있다. 코드 버그가 아니라 **spec 문서 구조 개선 사항**이다(consistency-check INFO #6 과 동일).
- **제안**: 코드 유지. `spec/7-channel-web-chat/4-security.md` §1 의 구현 세부를 `"XSS 방지 — deny-by-default 화이트리스트(위젯 책임). 세부 §1.1"` 수준으로 간결화하고 구현 세부는 §1.1 에만 두는 구조로 spec 개선.

---

### [INFO] `spec/7-channel-web-chat/4-security.md` §1.1 — 메인 앱 sanitize 정책의 이중 SoT 위험

- **위치**: `spec/7-channel-web-chat/4-security.md` §1.1 "메인 앱 assistant 패널 메시지" 행
- **상세**: `spec/7-channel-web-chat/4-security.md` 는 web-chat 전담 spec 이지만, §1.1 매트릭스에 `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx`(메인 앱) 의 sanitize 정책을 병기한다. 현재 메인 앱 영역(`spec/3-workflow-editor` · `spec/2-navigation`) 에 이 정책의 SoT 가 없어 유일한 문서화 위치이기도 하다. 기능 요구사항을 위반하는 버그는 아니나, `markdown-renderer.tsx` sanitize 가 변경될 경우 두 파일을 동시 갱신해야 하는 이중 관리 부담이 있다.
- **비즈니스 로직**: "두 렌더러가 동일 위협에 보안 동등성을 보장한다"는 cross-cutting 정책을 한 곳에 집약한 의도는 합리적이다. 단기 현위치 유지 허용.
- **제안**: 중기적으로 메인 앱 sanitize 정책 SoT 를 `spec/3-workflow-editor` 또는 `spec/2-navigation` 영역에 두고 §1.1 에서 cross-reference 로 전환.

---

### [INFO] `spec/5-system/1-auth.md` §1.4.J·§1.4.K — 신규 Rationale 기능 완전성 검토

- **위치**: `spec/5-system/1-auth.md` 라인 583–605 (1.4.J, 1.4.K)
- **상세**: 1.4.J(otplib v13 업그레이드 근거)와 1.4.K(복구 코드 SHA-256·KDF 미채택 근거)가 신규 추가됐다. 내용을 실제 구현(`totp.service.ts` 의 `generateSecret`, `verifySync`, `epochTolerance: 30` 사용)과 대조하면 완전히 일치한다. `v12 window:1` → `v13 epochTolerance:30` 등가 기술, RFC 6238 Appendix B 벡터 cross-version 단위 테스트 보장 언급 모두 코드와 정합. 1.4.K 의 "randomBytes(9)(72비트) 기반" 고엔트로피 근거도 기능상 올바른 분석이다. 기능 누락 없음.
- **제안**: 없음.

---

### [INFO] `spec/1-data-model.md` §2.1 — `two_factor_secret` 표기 변경

- **위치**: `spec/1-data-model.md` 라인 74
- **상세**: `(otplib base32)` → `(base32, RFC 6238 호환 — 라이브러리 무관)` 으로 변경. 라이브러리 무관 추상 표현으로 전환해 v13 업그레이드 후에도 spec 이 유효하게 됐다. 필드 타입·nullable 정책·기타 행동 정의는 변경 없음. 기능 요구사항에 영향 없음.
- **제안**: 없음.

---

### [INFO] consistency-check 산출물 — `_retry_state.json` agents_pending 필드 초기 상태 잔류

- **위치**: `review/consistency/2026/06/17/00_54_07/_retry_state.json`
- **상세**: `agents_pending` 에 5개 checker 가 모두 남아 있고 `agents_success` 가 빈 배열이다. 이는 orchestrator 가 retry_state 를 초기화한 시점의 스냅샷이며, 최종 산출물(`SUMMARY.md`)이 정상 생성되어 있고 각 checker 결과 파일도 모두 존재하므로 실제 실행 결과에 영향은 없다. 단 retry_state 가 완료 시점에 업데이트되지 않은 경우 재실행 시 혼동 가능성이 있다. orchestrator 의 상태 업데이트 생략 여부이며, review 산출물 자체의 기능 문제는 아니다.
- **제안**: 없음(review 산출물 내용은 정상). 필요 시 orchestrator 가 최종 완료 후 retry_state 갱신하는 패턴 검토.

---

### [INFO] [SPEC-DRIFT] `spec/4-nodes/5-data/2-code.md` §Rationale — `node>=22` 표기가 실제 최소 요건 `node>=24` 와 불일치

- **위치**: `spec/4-nodes/5-data/2-code.md` §Rationale 라인 470 (`"isolated-vm 버전은 node>=22 를 지원하는 6.x 라인을 사용한다"`)
- **충돌**: `codebase/backend/package.json engines.node = ">=24"` (이번 변경 포함)
- **상세**: isolated-vm 6.x 가 Node 22 를 지원하는 것은 사실이나, 프로젝트 최소 요건은 `engines.node >= 24` 로 상향됐다. 이는 코드가 의도적으로 개선·상향된 것이고 spec 이 라이브러리 지원 범위를 설명하는 문맥이므로 코드 롤백 대상이 아니라 **spec 갱신 누락**이다. 셀프호스팅 배포자가 Node 22 환경에 배포하려 할 수 있어 실무 혼동 가능성이 있다(consistency-check W-1 과 동일).
- **제안**: 코드 유지. `spec/4-nodes/5-data/2-code.md` §Rationale 의 해당 문구를 `"isolated-vm 6.x 라인을 사용한다 (node>=22 지원, 프로젝트 최소 요건은 node>=24 — package.json engines 참조)"` 로 갱신. 반영은 `project-planner` 위임.

---

## 요약

이번 변경의 주요 spec 수정(spec/1-data-model.md 1줄, spec/5-system/1-auth.md Rationale 2항목 신설, spec/7-channel-web-chat/4-security.md §1.1 매트릭스·R4·frontmatter 추가) 은 의도한 기능(otplib v13 업그레이드 후속 spec 동기화, 마크다운 sanitize 정책 문서화)을 완전히 충족한다. spec 본문과 코드 구현 사이에 기능 요구사항 위반에 해당하는 CRITICAL 불일치는 없다. 미처리 항목은 consistency-check W-2의 소문자 `m-1` 레이블 수정이 유일한 WARNING 이며, 나머지는 문서 구조·SoT 방향 개선 권장(INFO/SPEC-DRIFT)이다. 에러 시나리오·경계값·비즈니스 로직은 기존 spec 의 TOTP RFC 6238 호환·복구 코드 SHA-256 정책·XSS deny-by-default 정책 모두 구현과 정합하게 서술됐고 엣지 케이스(빈 입력 throw 없음, SSR null 폴백)도 R4에 명시됐다.

---

## 위험도

LOW
