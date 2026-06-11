# 부작용(Side Effect) 리뷰 결과

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**세션**: `review/code/2026/06/11/23_14_40/`
**이전 세션 참조**: `review/code/2026/06/11/23_00_44/side_effect.md` — 이전 세션의 발견사항을 계승하되, 이번 diff에 신규 포함된 변경(`backend-labels.ts` `HTTP_BLOCKED` 추가)을 추가 분석한다.

---

## 발견사항

### 1. **[WARNING]** SSRF 가드 적용 범위 확장 — `none`/`custom` 호출자의 의도하지 않은 동작 변경 (이전 세션 계승)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — `if (authentication === 'integration')` 게이트 제거 (line 344 unconditional SSRF guard try-catch)
- **상세**: 변경 전 `authentication='none'` 또는 `'custom'` 으로 사설 IP(RFC1918, 169.254.x.x, loopback 등)를 호출하던 워크플로는 정상 진행됐다. 변경 후 동일 호출이 `HTTP_BLOCKED` error 포트로 차단된다. 이는 의도된 secure-by-default 이나, 기존 self-host 배포에서 `authentication=none` 으로 내부 서비스를 호출하는 모든 워크플로가 즉시 실패하는 외부 부작용이다. `ALLOW_PRIVATE_HOST_TARGETS=true` 설정으로 opt-out 가능하지만, 기존 사용자가 이 플래그를 모르는 경우 서비스 중단이 발생한다.
- **제안**: PR 본문과 릴리스 노트에 breaking change 명시 (plan 문서에 경고 포함됨 — 실제 배포 공지 확인 필요). 에러 응답의 `output.error.message` 에 `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 안내 포함 권장.

### 2. **[INFO]** `configEcho` 빌드 방식 변경 — spread에서 명시 열거로 (이전 세션 계승)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 163–176 (configEcho 명시 열거 블록)
- **상세**: 기존 spread 방식은 `rawConfig`에 미래에 추가되는 모든 필드를 자동으로 echo에 포함시켰다. 변경 후 명시 열거로 전환하면, 새 스키마 필드가 `http-request.schema.ts`에 추가될 때 `configEcho` 빌드 코드도 함께 갱신하지 않으면 해당 필드가 출력에서 누락된다. 이는 의도치 않은 "silent omission" 부작용이다. 현재 주석은 이 수동 동기화 의무를 명시하여 인지는 되어 있다.
- **제안**: `http-request.schema.ts`의 필드 목록과 `configEcho` 열거를 동기화하는 단위 테스트 추가 또는 스키마 `keyof` 순회 검증 테스트.

### 3. **[INFO]** 테스트에서 `process.env.ALLOW_PRIVATE_HOST_TARGETS` 직접 변경 — 전역 상태 변경 (이전 세션 계승)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` line 141–167
- **상세**: 테스트가 `process.env.ALLOW_PRIVATE_HOST_TARGETS`를 직접 설정하고 `finally` 블록에서 복원한다. Jest 워커 파일 단위 격리 시 안전하나, `--runInBand` 또는 같은 워커에서 동일 env var를 읽는 다른 테스트와 병렬 실행 시 전역 상태 경합 가능성이 있다.
- **제안**: 현행 수용 가능. 확산 시 `jest.isolateModules` 또는 `jest.spyOn` 방식 전환 검토.

### 4. **[INFO]** `HTTP_BLOCKED` enum 추가 — 기존 사용자에 대한 영향 (이전 세션 계승)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/core/error-codes.ts` line 16 (`HTTP_BLOCKED: 'HTTP_BLOCKED'` 신규 추가)
- **상세**: 추가 전용(additive) 변경으로 기존 코드를 깨지 않는다. 다만 핸들러 내 `new IntegrationError('HTTP_BLOCKED', ...)` 가 enum을 참조하지 않고 string literal을 사용하여 enum 추가 효과가 완전하지 않다. 타입 안전성 관점의 부작용이다.
- **제안**: `http-request.handler.ts`에서 `'HTTP_BLOCKED'` string literal을 `ErrorCode.HTTP_BLOCKED`로 교체.

### 5. **[INFO]** Usage 로그 조건부 실행 — `none`/`custom` SSRF 차단 시 로그 미생성 (이전 세션 계승)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 350 (`if (authentication === 'integration' && integrationId)` 조건)
- **상세**: `none`/`custom` 인증의 SSRF 차단 이벤트가 어디에도 기록되지 않는다. 의도된 동작(spec §4.2)이나 보안 감사 관점의 운영 가시성 공백이다. 특히 이번 변경으로 `none`/`custom` 인증도 SSRF 가드에 도달하게 됐으므로 이 공백이 전보다 더 넓어졌다.
- **제안**: 보안 감사 요건 있으면 별도 security log 채널 추가 검토. 현재 spec 범위 내에서는 INFO 수준.

### 6. **[INFO]** redirect 루프 가드가 `authentication === 'integration'` 에만 적용됨 — `none`/`custom` 무한 redirect 가능
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 409–425 (`while (authentication === 'integration' && ...)`)
- **상세**: redirect hop 제한 및 redirect 대상 SSRF 재검증 루프가 `authentication === 'integration'` 조건으로만 실행된다. `none`/`custom` 인증으로 fetch 를 수행할 때 리다이렉트가 발생하면 hop 제한 없이 반복 fetch 가 발생하고, redirect 대상의 SSRF 재검증도 수행되지 않는다. 이는 이번 변경 이전부터 존재하던 동작이나, SSRF 가드가 전 인증 방식에 적용되는 취지와 논리적 불일치가 있다. redirect 를 통해 내부 호스트로 우회하는 공격 벡터가 `none`/`custom` 경로에서는 최초 URL 검사를 통과한 이후 redirect 에 대해 열려 있다.
- **제안**: `while` 루프의 `authentication === 'integration'` 조건 제거하여 redirect SSRF 재검증 및 hop 제한을 전 인증 방식으로 확대 적용을 검토한다. 혹은 spec 에 `none`/`custom` 에서 redirect 미추적(자동 follow 하지 않음, `fetchOptions.redirect = 'manual'` 로 redirect 응답 그대로 반환)을 명시한다. 현재 코드는 `fetchOptions.redirect = 'manual'` 로 설정되어 있으나 `none`/`custom` 경로에서는 redirect 를 while 루프 없이 그대로 반환하므로 사실상 redirect 를 follow 하지 않는다 — 이 동작을 spec 및 주석에 명문화하면 혼란이 해소된다.

### 7. **[INFO]** `backend-labels.ts` `HTTP_BLOCKED` 한국어 메시지 추가 — 에러 메시지 내 환경변수명 노출
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/frontend/src/lib/i18n/backend-labels.ts` line 584–585
- **상세**: 추가된 메시지("...자체 호스팅 환경에서 사설망 접근이 필요하면 관리자가 ALLOW_PRIVATE_HOST_TARGETS 를 설정해야 해요.")가 사용자 가시 UI 에 `ALLOW_PRIVATE_HOST_TARGETS` 환경변수명을 직접 노출한다. 이는 의도적으로 opt-out 방법을 안내하는 것으로 운영 친화적이지만, 환경변수명이 공개 UI 에 노출되면 보안 공격자가 해당 설정 여부를 탐지하는 정보로 활용될 수 있다. 단, 이 메시지는 이미 SSRF 차단이 발생한 후 운영자(워크플로 작성자)에게만 표시되는 컨텍스트라면 실질적 위험은 낮다.
- **제안**: 최종 사용자(워크플로 실행 결과를 보는 고객)에게 노출될 경우 환경변수명을 관리자 콘솔이나 서버 로그로 제한하고 UI 메시지는 "관리자에게 문의하세요" 수준으로 일반화한다. 워크플로 작성자/관리자 전용 컨텍스트라면 현행 수용 가능.

---

## 요약

이번 변경의 핵심 부작용은 `authentication='none'`/`'custom'` HTTP 요청이 사설망·loopback·클라우드 메타데이터 대상을 호출하는 기존 워크플로가 `HTTP_BLOCKED`로 즉시 차단된다는 점이다. 이는 의도된 secure-by-default 결과이나 기존 self-host 배포에 대한 breaking change이므로, 릴리스 노트와 배포 공지에 `ALLOW_PRIVATE_HOST_TARGETS=true` 마이그레이션 경로가 명확히 포함되어야 한다(plan 문서에 경고가 이미 포함됨). 이번 diff에서 신규 추가된 `backend-labels.ts` `HTTP_BLOCKED` 한국어 메시지는 이전 세션(23_00_44)의 WARNING #7을 해소하는 올바른 변경이며, opt-out 안내(`ALLOW_PRIVATE_HOST_TARGETS`)를 메시지에 포함시켜 운영 친화성을 높였다. 단, 이 메시지가 최종 사용자 UI 에 노출되는 컨텍스트에서는 환경변수명 노출이 부적절할 수 있다. 새로 발견된 중요 사항은 redirect 루프 재검증이 `none`/`custom` 에 적용되지 않는다는 점으로, SSRF 가드를 전 인증 방식으로 확대한 취지와 논리적으로 불일치하며 redirect 를 통한 내부 호스트 우회 경로가 남아 있다. 전역 변수 오염·네트워크 부작용·이벤트 콜백 변경은 없으며, 공개 API 시그니처는 변경되지 않았다.

---

## 위험도

**MEDIUM**

(의도된 breaking change — `none`/`custom` 인증 사설망 호출 차단. 운영 영향이 있으나 마이그레이션 경로 단순. redirect 루프 SSRF 재검증 미적용(INFO)이 보안 취지와 불일치하나 `redirect = 'manual'` 설정으로 `none`/`custom` 에서는 실질적으로 redirect follow 가 발생하지 않아 즉시 악용 가능성은 낮음.)

STATUS: OK
