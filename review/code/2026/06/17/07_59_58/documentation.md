# 문서화(Documentation) 코드 리뷰

## 발견사항

### [INFO] `spec/7-channel-web-chat/4-security.md` §1 테이블 셀 — 인라인 리뷰 태그 잔류
- 위치: `spec/7-channel-web-chat/4-security.md` §1 보안 정책 요약 테이블, "입력 sanitize" 행 말미 `(refactor 04 m-1)`
- 상세: spec 본문 테이블 셀에 코드 리뷰 배치 출처 태그가 인라인으로 남아 있다. spec 본문은 결정된 사실의 SoT 여야 하며, 리뷰 출처 추적용 태그는 Rationale 절로 이동하거나 제거하는 것이 관례에 맞다. 이 PR 에서 R4 Rationale 항목이 `(refactor 07-dependency m-9)` 형태로 Rationale 에 추가된 패턴(spec/5-system/1-auth.md 1.4.J)과 일관성이 없다.
- 제안: `(refactor 04 m-1)` 표기를 §1 테이블에서 제거하거나 R4 Rationale 말미에 `(코드 리뷰 refactor 04 M-1 에서 도출)` 형태로 이동. 대소문자도 `m-1` → `M-1` 로 통일.

---

### [WARNING] `spec/7-channel-web-chat/4-security.md` §1 테이블 — 구현 세부와 정책 요약이 동일 셀에 혼재
- 위치: `spec/7-channel-web-chat/4-security.md` §1 "입력 sanitize" 행 (신규 내용)
- 상세: §1 테이블은 "정책 요약" 용도인데, 변경 후 해당 셀에 `DOMPurify ALLOWED_TAGS/ALLOWED_ATTR + ALLOWED_URI_REGEXP`, `javascript:`/`data:` 차단 등 구현 세부 API 이름이 직접 기술된다. 동일 세부는 §1.1 매트릭스 테이블에도 반복돼 있어 단일 진실 원칙에 위배된다. §1.1 내용이 변경될 경우 §1 테이블도 함께 갱신해야 하는 이중 갱신 부담이 생긴다.
- 제안: §1 "입력 sanitize" 셀을 `"XSS 방지 — deny-by-default 화이트리스트(위젯 책임). 세부 §1.1"` 수준으로 간결히 유지하고, 구현 API 이름(`ALLOWED_TAGS` 등)은 §1.1 에서만 기술.

---

### [INFO] `spec/5-system/1-auth.md` §1.4.J·§1.4.K Rationale — 문서화 품질 양호, 경미한 개선 여지
- 위치: `spec/5-system/1-auth.md` §1.4.J, §1.4.K (신규 추가 섹션)
- 상세: otplib v12→v13 업그레이드 근거(§1.4.J)와 복구 코드 SHA-256 선택 근거(§1.4.K) 모두 결정 배경·기각 대안·트레이드오프를 잘 기록하고 있다. `(refactor 07-dependency m-9)` 배치 태그가 Rationale 제목 행에 포함돼 있어 §1 본문 테이블의 `(refactor 04 m-1)` 태그 위치(테이블 셀 내)와 스타일이 다르다. 프로젝트 내 refactor 태그 위치 규약을 통일하면 독자 혼란을 줄일 수 있다.
- 제안: 태그 위치 규약(Rationale 제목 행 vs 본문 셀 말미)을 어느 한 방향으로 통일하거나, CLAUDE.md/conventions 에 한 줄 명시.

---

### [INFO] `spec/5-system/1-auth.md` §1.4.K — ai-review 언급이 spec 본문에 잔류
- 위치: `spec/5-system/1-auth.md` §1.4.K 근거 말미 `"(참고) ai-review 가 KDF 전환을 제안했으나(LOW/즉각 수정 불필요), 위 엔트로피 분석으로 현행 SHA-256 유지가 정설."`
- 상세: spec 본문에 내부 도구(ai-review)의 등급 기호(`LOW/즉각 수정 불필요`)가 노출돼 있다. spec 은 외부 독자도 참조하는 결정의 SoT 이므로, 내부 프로세스 언급보다 "KDF 전환 제안을 검토했으나 엔트로피 분석으로 기각"이라는 내용 중심 기술이 더 적절하다.
- 제안: `"ai-review 가 KDF 전환을 제안했으나(LOW/즉각 수정 불필요)"` → `"KDF 전환 방향을 검토했으나"` 로 내부 도구 언급 제거.

---

### [WARNING] `spec/4-nodes/5-data/2-code.md` — Node.js 최소 버전 표기 미갱신
- 위치: `spec/4-nodes/5-data/2-code.md` §Rationale, `isolated-vm 6.x (node>=22)` 문구
- 상세: 이 PR 에서 `codebase/backend/package.json` 에 `"engines": { "node": ">=24" }` 가 추가됐다. spec 은 여전히 `node>=22` 를 최소 요건으로 암시하는 문구를 보유 중이다. 셀프호스팅 배포자가 Node 22 환경에서 배포를 시도할 수 있는 잘못된 정보가 문서에 남는다.
- 제안: `"isolated-vm 버전은 node>=22 를 지원하는 6.x 라인을 사용한다"` → `"isolated-vm 6.x 라인을 사용한다 (node>=22 지원, 프로젝트 최소 요건은 node>=24 — package.json engines 참조)"` 로 갱신.

---

### [INFO] `spec/7-channel-web-chat/4-security.md` §1.1 — 메인 앱 sanitize 정책의 이중 SoT 위험 미해소
- 위치: `spec/7-channel-web-chat/4-security.md` §1.1 "메인 앱 assistant 패널 메시지" 행
- 상세: `spec/7-channel-web-chat/4-security.md` 는 web-chat 영역 전담 spec 인데, §1.1 매트릭스가 `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx`(메인 앱 영역)의 sanitize 정책을 함께 문서화한다. 메인 앱 렌더러 정책이 변경되면 web-chat spec 도 함께 갱신해야 하는 이중 SoT 가 된다. "검증 동등성"을 한 곳에서 보여준다는 cross-cutting 의도는 유효하나, SoT 분리 원칙과 충돌한다. 이 항목은 plan_coherence 리뷰에서도 INFO 로 지적됐으나 이번 PR 내에서 해소되지 않았다.
- 제안: 단기적으로 현 위치 유지 허용. 중기적으로 메인 앱 sanitize 정책을 메인 앱 영역 spec 에 SoT 를 두고 §1.1 에서 cross-reference 하는 방향으로 정비. 해당 중기 개선이 필요하다는 것을 `pending_plans` frontmatter 에 참조 plan 으로 기록하면 추적이 용이하다.

---

### [INFO] `spec/1-data-model.md §2.1` — 라이브러리 종속 표기 잔류 (선택적)
- 위치: `spec/1-data-model.md` `two_factor_secret` 행 (`TOTP secret (base32, RFC 6238 호환 — 라이브러리 무관)`)
- 상세: 이 PR 에서 `(otplib base32)` → `(base32, RFC 6238 호환 — 라이브러리 무관)` 으로 이미 갱신돼 있다. 변경 자체는 적절하다. 라이브러리 무관 표기로 전환한 의도와 이유(`otplib` 버전 변경에 따른 표현 중립화)가 `spec/5-system/1-auth.md` §1.4.J Rationale 에 대응되도록 연결 cross-ref 가 있으면 향후 독자에게 유용하다.
- 제안: `spec/1-data-model.md §2.1` 의 해당 주석에 `(SoT: 1-auth §1.4.J)` 한 줄 cross-ref 추가(선택).

---

### [INFO] `review/consistency/` 산출물 파일 — `meta.json` 의 `\n` 미삽입 (newline at end of file 없음)
- 위치: `review/consistency/2026/06/16/23_38_15/meta.json`, `review/consistency/2026/06/17/00_54_07/meta.json`, `review/consistency/2026/06/17/00_54_07/_retry_state.json`
- 상세: 세 JSON 파일 모두 `No newline at end of file` diff 마커가 있다. POSIX 표준 및 대다수 lint/editor 설정이 파일 말미 개행을 요구하며, git diff 노이즈 유발 가능성이 있다. 리뷰 산출물 파일은 자동 생성이므로 생성 스크립트 측에서 개행을 보장하는 것이 적절하다.
- 제안: 산출물 생성 스크립트에서 JSON 직렬화 후 `\n` 을 파일 말미에 추가하도록 수정.

---

### [INFO] `spec/7-channel-web-chat/4-security.md` R4 Rationale — 빈/경계 입력 설명 위치
- 위치: `spec/7-channel-web-chat/4-security.md` R4 Rationale 항목 말미 "빈/경계 입력" 단락
- 상세: R4 Rationale 절 말미에 `"빈 문자열·공백만 있는 입력은 throw 없이 안전한 빈/정상 string 을 반환한다"` 라는 구현 동작 설명이 포함돼 있다. Rationale 절은 "왜 이 선택인가"만 다루는 것이 관례인데(`CLAUDE.md` "본문은 latest-only 사실, 왜 이 선택인가는 Rationale"), 이 내용은 경계값 동작 사실에 해당하므로 §1.1 본문 매트릭스 하단 또는 §1.1 비고 행이 더 적절한 위치다.
- 제안: 해당 단락을 R4 에서 §1.1 매트릭스 하단 "참고" 행으로 이동.

---

## 요약

이번 변경은 `spec/7-channel-web-chat/4-security.md` 의 sanitize 정책 명시(§1.1 매트릭스 신규, R4 Rationale), `spec/5-system/1-auth.md` 의 otplib v13·SHA-256 복구 코드 Rationale 추가, `spec/1-data-model.md` 의 라이브러리 무관 표기 전환, 그리고 다수 consistency-check 산출물 파일 추가로 구성된다. 전반적으로 Rationale 문서화 수준이 양호하며 결정 배경이 잘 기록돼 있다. 주요 문서화 문제는 두 가지다. 첫째, `spec/4-nodes/5-data/2-code.md` 의 Node.js 최소 버전 문구(`node>=22`)가 실제 `engines.node >=24` 변경과 불일치해 셀프호스팅 배포자를 혼동시킬 수 있다(WARNING). 둘째, `spec/7-channel-web-chat/4-security.md` §1 테이블 "입력 sanitize" 셀에 §1.1 과 동일한 구현 세부가 중복 기술돼 단일 진실 원칙 위반을 일으킨다(WARNING). 나머지 발견사항은 refactor 태그 위치 불일치, ai-review 내부 언급, 파일 말미 개행 누락 등 경미한 INFO 수준이다.

## 위험도

LOW
