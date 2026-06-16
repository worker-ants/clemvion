# Code Review 통합 보고서

**리뷰 대상**: deps-backlog-residual 브랜치  
**리뷰 일시**: 2026-06-17  
**리뷰어**: security, requirement, scope, dependency, documentation

---

## 전체 위험도

**LOW** — Critical 발견사항 없음. Warning 3건(otplib caret 버전 고정 권장, spec Node.js 버전 표기 불일치, spec §1 테이블 이중 SoT)이 있으나 기능·보안 요건 위반은 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Dependency | `"otplib": "^13.4.1"` caret 버전 표기 — TOTP 보안 크리티컬 경로에서 13.x 패치 드리프트 허용 | `codebase/backend/package.json` | `"otplib": "13.4.1"` 로 정확 고정하거나, CI 에서 `npm ci` (lockfile strict) 강제. 패치 업그레이드 수동 검토 게이트 처리. |
| W-2 | Documentation / SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/5-data/2-code.md` §Rationale 의 `isolated-vm 6.x (node>=22)` 문구가 실제 `engines.node >=24` 와 불일치. 셀프호스팅 배포자 혼동 가능성. | `spec/4-nodes/5-data/2-code.md` §Rationale | `"isolated-vm 6.x 라인을 사용한다 (node>=22 지원, 프로젝트 최소 요건은 node>=24 — package.json engines 참조)"` 로 spec 갱신. `project-planner` 위임. |
| W-3 | Documentation | `spec/7-channel-web-chat/4-security.md` §1 테이블 "입력 sanitize" 셀에 `ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP` 등 구현 세부가 §1.1 매트릭스와 이중 기술 — 단일 진실 원칙 위반, 이중 갱신 부담 | `spec/7-channel-web-chat/4-security.md` §1 | §1 셀을 `"XSS 방지 — deny-by-default 화이트리스트(위젯 책임). 세부 §1.1"` 로 간결화. 구현 API 이름은 §1.1 에서만 기술. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Requirement | consistency-check W-2 미처리: `(refactor 04 m-1)` 소문자 태그가 `(refactor 04 M-1)` 대문자 규약과 불일치 | `spec/7-channel-web-chat/4-security.md` 라인 37 | `m-1` → `M-1` 1글자 수정 |
| I-2 | SPEC-DRIFT | [SPEC-DRIFT] §1 요약 테이블 구현 세부(ALLOWED_TAGS 등)와 §1.1 매트릭스의 이중 SoT — 코드 버그 아님, spec 문서 구조 개선 필요 | `spec/7-channel-web-chat/4-security.md` §1·§1.1 | §1 구현 세부를 §1.1 에만 두는 구조로 spec 개선 (W-3 과 연계) |
| I-3 | Documentation | §1.1 "메인 앱 assistant 패널 메시지" 행이 web-chat 전담 spec 에 메인 앱 sanitize 정책을 병기 — 이중 SoT 위험 | `spec/7-channel-web-chat/4-security.md` §1.1 | 단기 현위치 유지 허용. 중기적으로 메인 앱 sanitize 정책 SoT 를 `spec/3-workflow-editor` 등에 두고 cross-reference 로 전환 |
| I-4 | Documentation | `spec/5-system/1-auth.md` §1.4.K 말미에 `"ai-review 가 KDF 전환을 제안했으나(LOW/즉각 수정 불필요)"` 내부 도구·등급 표현이 spec 본문에 잔류 | `spec/5-system/1-auth.md` §1.4.K | `"ai-review 가 KDF 전환을 제안했으나(LOW/즉각 수정 불필요)"` → `"KDF 전환 방향을 검토했으나"` 로 내부 언급 제거 |
| I-5 | Documentation | refactor 태그 위치 규약 불일치: Rationale 제목행 표기(`1.4.J`) vs 본문 셀 말미 표기(`§1 테이블`) | `spec/5-system/1-auth.md`, `spec/7-channel-web-chat/4-security.md` | 규약 통일 또는 conventions 한 줄 명시 |
| I-6 | Documentation | R4 Rationale 에 경계값 동작 사실("빈 문자열 throw 없이 안전 반환")이 포함됨 — Rationale 은 "왜" 만, 동작 사실은 본문 매트릭스가 적합 | `spec/7-channel-web-chat/4-security.md` R4 | 해당 단락을 §1.1 매트릭스 하단 참고 행으로 이동 |
| I-7 | Dependency | `@noble/hashes`, `@scure/base` 신규 transitive dep 도입 — 품질·라이선스 양호하나 최초 머지 후 `npm audit --production` 클린 확인 권장 | `codebase/backend/package-lock.json` (transitive) | CI `npm audit` 범위에 명시적 포함 확인. 클린 결과를 plan/complete 에 기록 권장 |
| I-8 | Security | 복구 코드 SHA-256 단순 해시 — KDF 미채택. spec §1.4.K 에 고엔트로피 근거 명문화. OWASP 정합, 설계 결정 확인됨 | `codebase/backend/src/modules/auth/totp.service.ts` line 27-29 | 조치 불필요 |
| I-9 | Documentation | `review/consistency/` 산출물 JSON 파일 말미 개행 누락 (`No newline at end of file`) | `meta.json`, `_retry_state.json` 3개 파일 | 산출물 생성 스크립트에서 JSON 직렬화 후 `\n` 추가 |
| I-10 | Requirement | consistency-check `_retry_state.json` `agents_pending` 초기 상태 잔류 — 실행 결과에 영향 없음, orchestrator 완료 시점 상태 업데이트 미수행 | `review/consistency/2026/06/17/00_54_07/_retry_state.json` | 조치 불필요 (산출물 정상). orchestrator 완료 후 retry_state 갱신 패턴 검토 |
| I-11 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/5-data/2-code.md` §Rationale `node>=22` 표기 — 코드는 의도적으로 `>=24` 로 상향됐고 spec 이 라이브러리 지원 범위 설명 문맥에서 낡음 | `spec/4-nodes/5-data/2-code.md` §Rationale | W-2 와 동일. spec 갱신 (`project-planner` 위임) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. TOTP 에러 핸들러 민감정보 미노출, DOMPurify deny-by-default 정합, 복구 코드 SHA-256 OWASP 정합 확인 |
| requirement | LOW | consistency-check W-2 `m-1` 소문자 미수정(WARNING). spec-code 기능 요건 불일치 없음 |
| scope | NONE | 모든 변경이 deps-backlog-residual 목적(의존성 잔여 처리 + spec 동기화)과 일치. 무관 파일 수정 없음 |
| dependency | LOW | `otplib ^13.4.1` caret 고정 권장(WARNING). `@noble/hashes`·`@scure/base` 신규 transitive dep 감사 권장(INFO) |
| documentation | LOW | `spec/4-nodes/5-data/2-code.md` node>=22 vs >=24 불일치(WARNING), §1 테이블 이중 SoT(WARNING). 나머지 refactor 태그 위치·ai-review 언급 등 INFO |

---

## 발견 없는 에이전트

- **scope** — 범위 이탈, 무관 수정, 요청되지 않은 리팩토링 발견 없음.
- **security** — CRITICAL/WARNING 수준 보안 취약점 발견 없음.

---

## 권장 조치사항

1. **(W-1, 즉시 권장)** `codebase/backend/package.json` 의 `"otplib": "^13.4.1"` → `"otplib": "13.4.1"` 로 정확 고정. TOTP 는 보안 크리티컬 경로이므로 caret 패치 드리프트 허용은 위험.
2. **(W-2, spec 갱신 필요)** `spec/4-nodes/5-data/2-code.md` §Rationale 의 `node>=22` 문구를 `node>=24` 실제 요건과 일치하도록 갱신. 셀프호스팅 배포자 혼동 방지. `project-planner` 위임.
3. **(W-3, spec 구조 개선)** `spec/7-channel-web-chat/4-security.md` §1 테이블 "입력 sanitize" 셀의 구현 세부(`ALLOWED_TAGS` 등)를 §1.1 로 이동하고 §1 셀은 요약 수준으로 간결화. 단일 진실 원칙 복원.
4. **(I-1, 소규모)** `spec/7-channel-web-chat/4-security.md` 라인 37: `(refactor 04 m-1)` → `(refactor 04 M-1)` 대소문자 통일.
5. **(I-4, 문서 정제)** `spec/5-system/1-auth.md` §1.4.K 말미의 `"ai-review 가 KDF 전환을 제안했으나(LOW/즉각 수정 불필요)"` 구절을 내부 도구 언급 없는 의사결정 언어로 교체.
6. **(I-7, CI)** 머지 후 `npm audit --production` 실행해 `@noble/hashes`·`@scure/base` 취약점 클린 여부 확인.

---

## 라우터 결정

라우터 미사용 — 사유: `routing=all`. 전체 reviewer 실행.

- **실행**: security, requirement, scope, dependency, documentation (5명)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, requirement