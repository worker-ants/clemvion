# Code Review 통합 보고서

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**세션**: `review/code/2026/06/11/23_14_40/`

---

## 전체 위험도

**MEDIUM** — SSRF 에러 메시지 hostname/IP 정보 노출(보안 경고) + `none`/`custom` 인증 breaking change(운영 영향) 2건이 WARNING 수준으로 잔존. Critical 없음. 이전 세션(23_00_44) WARNING #5·#6·#7 전항목 해소 확인.

---

## Critical 발견사항

*없음*

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 보안 — 정보 노출 | SSRF 차단 에러 메시지에 차단된 hostname 및 resolved IP 주소가 그대로 포함되어 `output.error.message` 로 클라이언트에 전달됨 — 내부 DNS 매핑·네트워크 토폴로지 정찰 가능 (OWASP A05) | `http-safety.ts` line 107, 147; `http-request.handler.ts` line 366 | 클라이언트 응답에는 `"Request blocked by SSRF security policy"` 일반화 메시지만 반환. 상세 hostname/IP 는 서버 측 구조화 로그에만 기록. `buildPreflightErrorOutput` 호출 시 메시지 정규화 또는 `IntegrationError` 에 별도 `publicMessage` 필드 도입 |
| W2 | 보안 — 런타임 조작 | `ALLOW_PRIVATE_HOST_TARGETS` 가 `process.env` 에서 매 SSRF 가드 호출마다 재평가됨 — prototype pollution 등 `process.env` 조작 가능한 취약점 존재 시 SSRF 보호 전체 무효화 가능 | `http-safety.ts` line 80–82 `isPrivateHostsAllowed()` | 모듈 최상단에 `const PRIVATE_HOSTS_ALLOWED = process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true'` 로 한 번만 읽어 상수로 고정. `true` 설정 시 시작 시 경고 로그 출력 권장 |
| W3 | 부작용 — Breaking Change | `authentication='none'`/`'custom'` + 사설 IP 호출 기존 워크플로가 `HTTP_BLOCKED` 로 즉시 차단됨 — 기존 self-host 배포에 대한 breaking change. 의도된 secure-by-default 이나 마이그레이션 안내 없으면 서비스 중단 | `http-request.handler.ts` line 344 (unconditional SSRF guard) | PR 본문·릴리스 노트에 breaking change 명시. `output.error.message` 에 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 안내 포함 권장 (plan 문서 경고 이미 포함됨) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 | DNS rebinding race window — `assertSafeOutboundHostResolved` 후 fetch 사이 TTL 만료 재바인딩 가능성. 코드 주석에 인지·"pair with egress firewall" 명시됨 | `http-safety.ts` line 119–120 주석 | 추가 코드 조치 불필요. 운영 egress 방화벽 병행 필수 |
| I2 | 보안 | DNS 실패(ENOTFOUND) 시 fail-open — 의도적 설계. 코드 주석 명시 | `http-safety.ts` line 137–141 | 추가 조치 불필요 |
| I3 | 보안 | redirect 루프 재검증(`assertSafeOutboundHostResolved` + hop 제한)이 `authentication === 'integration'` 에만 적용됨. `none`/`custom` 에서 redirect follow 시 SSRF 재검증 미수행. 단, `fetchOptions.redirect = 'manual'` 로 현재 `none`/`custom` 경로에서 redirect 가 실제로 follow 되지 않아 즉시 악용 가능성 낮음 | `http-request.handler.ts` line 409–425 `while` 루프 조건 | redirect 재검증 루프를 전 인증 방식으로 확대하거나, spec 및 코드 주석에 `none`/`custom` 경로의 redirect 미추적(`redirect='manual'`) 정책을 명문화 |
| I4 | 보안 | 테스트 fixture 에 `SUPER_SECRET_KEY`, `LEAKED_TOKEN` 등 시크릿 스캐너 오탐 유발 가능한 값 사용 | `http-request.handler.spec.ts` line 74–75 (추정) | `DUMMY_KEY_FOR_TESTING`, `TEST_ONLY_NOT_A_REAL_KEY` 등 명시적 더미값으로 교체 |
| I5 | 보안 | `HTTP_BLOCKED` opt-out(`ALLOW_PRIVATE_HOST_TARGETS`) 안내가 서버 로그·에러 객체 메시지에 미포함 — self-hosted 운영자가 에러 로그만으로 조치 방법 파악 어려움 | `http-safety.ts` 에러 메시지, `backend-labels.ts` 프론트 전용 | 서버 측 에러 메시지 또는 구조화 로그에 opt-out 안내 포함 (W1 fix 와 조합: 클라이언트 일반화 + 서버 로그 상세+opt-out 안내) |
| I6 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/4-integration/1-http-request.md §4 step 8` 에 dry-run 시 SSRF 가드 생략 예외 미명문화. 코드 주석은 의도 명시. 코드 동작이 합리적·의도적이며 revert 가 오답 — spec 만 낡아 있음 | `spec/4-nodes/4-integration/1-http-request.md §4 step 8` | spec §4 step 8에 "(dry-run 실행 시 실제 fetch 없으므로 SSRF 가드 생략 — `spec/5-system/13-replay-rerun.md §7` 참조)" 한 줄 추가. `project-planner` 위임 사항 |
| I7 | 부작용 | `configEcho` 명시 열거 전환 후 새 스키마 필드 추가 시 silent omission 위험. 현재 주석에 수동 동기화 의무 명시됨 | `http-request.handler.ts` line 163–176 | 스키마 keyof 순회로 configEcho 누락 필드를 감지하는 단위 테스트 추가 권장 |
| I8 | 부작용 | `none`/`custom` SSRF 차단 이벤트가 어디에도 기록되지 않음(spec §4.2 의도적 동작). SSRF 가드 범위 확대로 로깅 공백이 이전보다 넓어짐 | `http-request.handler.ts` line 350 조건 | 보안 감사 요건 있으면 별도 security log 채널 추가 검토 |
| I9 | 부작용 | `error-codes.ts` 에 `HTTP_BLOCKED` string literal 로 참조 — `ErrorCode.HTTP_BLOCKED` enum 미사용. 타입 안전성 미흡 | `http-request.handler.ts` `new IntegrationError('HTTP_BLOCKED', ...)` | `'HTTP_BLOCKED'` string literal을 `ErrorCode.HTTP_BLOCKED` 로 교체 |
| I10 | 부작용 | `backend-labels.ts` `HTTP_BLOCKED` 메시지 내 환경변수명 `ALLOW_PRIVATE_HOST_TARGETS` 공개 UI 노출. 최종 사용자 대상이면 과도한 기술 정보 | `backend-labels.ts` line 584–585 | 최종 사용자 노출 컨텍스트라면 "관리자에게 문의하세요" 수준으로 일반화. 운영자 전용 컨텍스트라면 현행 수용 가능 |
| I11 | 테스트 | `none` × IMDS, `custom` × RFC1918 교차 조합 미검증. 반대 조합(`none + RFC1918`, `custom + IMDS`) 누락 | `http-request.handler.spec.ts` lines 961–999 | `test.each` 로 4개 조합 data-driven 통합 |
| I12 | 테스트 | `custom` + `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트 누락 (`none` 만 검증) | `http-request.handler.spec.ts` lines 1001–1029 | opt-out 테스트를 `test.each(['none', 'custom'])` 으로 파라미터화 |
| I13 | 테스트 | `none`/`custom` 인증 + loopback(`localhost`) 차단 테스트 누락 | `http-request.handler.spec.ts` line 937 | `blocks localhost by name` 테스트를 `test.each(['none', 'custom', 'integration'])` 으로 확장 |
| I14 | 테스트 | SSRF 차단(error 경로) configEcho Principle 7 D1 credential 미포함 명시 단언 부재 — 성공 경로에서만 간접 보증 | `http-request.handler.spec.ts` lines 961–999 | `blocks authentication=none requests to cloud IMDS` 테스트에 `expect(result.output.config).not.toHaveProperty('apiKey')` 단언 추가 |
| I15 | 테스트 | dry-run + `none`/`custom` SSRF skip 동작 미검증. dry-run 분기가 가드 앞에 있어 skip 되어야 하나 `none`/`custom` 경로 전용 단언 없음 | `http-request.handler.spec.ts` line 569 | `none` + `169.254.169.254` + `__dryRun: true` → `port: 'success'` 단언 추가 |
| I16 | 테스트 | `backend-labels.ts` `HTTP_BLOCKED` i18n 매핑 검증 테스트 없음 | `backend-labels.ts` | `translateErrorCode('HTTP_BLOCKED')` 반환값 검증 단위 테스트 추가 |
| I17 | 테스트 | Principle 7 D1 credential-leak 테스트에서 `makeContext` vs `execute` 인자 분리 의도 주석 부재 | `http-request.handler.spec.ts` lines 135–160 | 두 인자가 다른 이유(rawConfig 필터링 검증)를 주석으로 명시 |
| I18 | 문서화 | `error-codes.ts` `HTTP_BLOCKED` 주석에 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 및 `http-safety.ts` SoT 참조 미포함. 인접 `EMAIL_HOST_BLOCKED` 주석과 일관성 낮음 | `error-codes.ts` line 14–16 | `// ALLOW_PRIVATE_HOST_TARGETS=true 로 opt-out. 상세: http-safety.ts` 추가 |
| I19 | 문서화 | `spec/conventions/node-output.md` D4 callout 링크에 anchor 없어 §5.8 위치로 직접 점프 불가 | `spec/conventions/node-output.md` D4 callout | `#58-d4-...` anchor 추가 |
| I20 | 문서화 | `http-request.handler.ts` 주석·`error-codes.ts` 주석에 내부 작업 식별자 `(refactor 04 C-3)` 잔존 — 외부 독자에 불투명 | `http-request.handler.ts` SSRF 가드 주석; `error-codes.ts` line 15 | 제거하거나 `plan/in-progress/refactor/04-security.md C-3` 경로 참조로 교체 |
| I21 | 문서화 | PR 본문·릴리스 노트 breaking change 블록 기재 여부 미확인 (diff 범위 외) | PR 본문 | 머지 전 `ALLOW_PRIVATE_HOST_TARGETS=true` 마이그레이션 경로 포함 여부 체크리스트 확인 |
| I22 | 문서화 | `ALLOW_PRIVATE_HOST_TARGETS` 적용 범위 확장(전 인증 방식)이 외부 운영 문서(README, docker-compose, Helm values 등)에 반영됐는지 확인 불가 | diff 범위 외 운영 문서 | PR 체크리스트에 "외부 운영 문서 갱신" 항목 추가 |
| I23 | 요구사항 | `HTTP_TIMEOUT` enum 이 `error-codes.ts` 에 잔존하나 `HTTP_TRANSPORT_FAILED` 가 타임아웃을 흡수하는 실제 동작과 괴리 — 본 변경 이전부터 존재하는 상태이며 신규 결함 아님 | `error-codes.ts` line 13 | 별도 정리 작업 대상. 본 변경 범위 외 |
| I24 | 부작용 | `process.env.ALLOW_PRIVATE_HOST_TARGETS` 직접 조작 테스트 패턴 — `--runInBand` + 동일 env var 읽는 병렬 테스트 시 경합 가능성 (현재 1개 테스트에만 있어 위험 낮음) | `http-request.handler.spec.ts` lines 1001–1029 | 현행 유지. 동일 패턴 3회 이상 시 `withEnv(key, value, fn)` 헬퍼 추출 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | SSRF 에러 메시지 hostname/IP 노출(W1), `process.env` 런타임 조작 가능성(W2). 핵심 변경 방향은 보안 개선 |
| requirement | LOW | 기능 요구사항 전항목 충족. SPEC-DRIFT 1건(dry-run 예외 미명문화) |
| scope | NONE | 모든 변경이 지적된 발견사항의 직접 해소 범위 내. 불필요한 확장 없음 |
| side_effect | MEDIUM | `none`/`custom` 인증 breaking change(W3), redirect 루프 재검증 비대칭(I3) |
| maintainability | NONE | 이전 세션 WARNING 3건 해소. 신규 유지보수성 문제 없음 |
| testing | LOW | 핵심 보안 경로 테스트 추가 충분. 교차 조합·dry-run×none/custom 등 갭 6건(모두 INFO) |
| documentation | LOW | 이전 WARNING 해소 확인. dry-run spec 미명문화, anchor 누락, PR 본문 확인 필요 |
| api_contract | LOW | 이전 세션 WARNING #5·#6·#7 해소. 잔존 WARNING #1·#2·#3·#4는 이전 세션 기록 사항 |
| user_guide_sync | NONE | HTTP_BLOCKED ERROR_KO 매핑 HEAD 기준 해소. 동반 갱신 누락 0건 |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음, 모든 변경이 의무 범위 내
- **maintainability**: Critical·Warning 수준 신규 문제 없음
- **user_guide_sync**: 동반 갱신 누락 없음 (HEAD 기준)

---

## 권장 조치사항

1. **[W1 — 최우선]** `http-safety.ts` 에러 메시지에서 hostname/IP 제거. 클라이언트에는 일반화 메시지(`"Request blocked by SSRF security policy"`)만 반환하고, 상세 정보는 서버 구조화 로그에만 기록. `buildPreflightErrorOutput` 또는 `IntegrationError` 생성 레이어에서 메시지 정규화.
2. **[W2]** `isPrivateHostsAllowed()` 함수 제거하고 모듈 최상단 `const PRIVATE_HOSTS_ALLOWED` 상수로 교체. `true` 설정 시 시작 시 경고 로그 출력.
3. **[W3]** PR 본문·릴리스 노트에 breaking change 블록(`authentication=none/custom` + 사설망 호출 차단, `ALLOW_PRIVATE_HOST_TARGETS=true` 마이그레이션 경로) 기재 확인.
4. **[I6 — SPEC-DRIFT]** `project-planner` 위임: `spec/4-nodes/4-integration/1-http-request.md §4 step 8` 에 dry-run SSRF 가드 생략 예외 한 줄 추가.
5. **[I3]** `none`/`custom` 경로에서 redirect 미추적(`redirect='manual'`) 정책을 spec §4 및 코드 주석에 명문화하거나, redirect 재검증 루프를 전 인증 방식으로 확대.
6. **[I9]** `http-request.handler.ts` 내 `'HTTP_BLOCKED'` string literal을 `ErrorCode.HTTP_BLOCKED` enum 참조로 교체.
7. **[I11–I16]** 테스트 갭 보완: 교차 인증×대역 조합, `custom` opt-out, loopback `none`/`custom`, dry-run×`none`/`custom`, error 경로 Principle 7 D1 단언, `HTTP_BLOCKED` i18n 매핑 테스트.
8. **[I18]** `error-codes.ts` `HTTP_BLOCKED` 주석에 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 및 `http-safety.ts` 참조 추가.
9. **[I22]** 외부 운영 문서(`ALLOW_PRIVATE_HOST_TARGETS` 관련 README, 배포 가이드)에 적용 범위 확장 반영 여부 확인.

---

## 라우터 결정

**실행** (ran): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (9명)

**강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

**제외 (skipped)**: 5명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 해당 없음 (라우터 판단) |
| architecture | 해당 없음 (라우터 판단) |
| dependency | 해당 없음 (라우터 판단) |
| database | 해당 없음 (라우터 판단) |
| concurrency | 해당 없음 (라우터 판단) |