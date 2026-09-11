# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. 신규 WARNING 2건은 모두 기능 회귀가 아니라 "이 PR 이 스스로 세운 규칙(§5.3 details[].code 배선)에서 벗어난 한 자리"와 "이 PR 이 완료한 배선을 spec 문서 한 문단이 아직 옛 시제로 서술"하는 문서/일관성 성격의 문제다. 14개 reviewer(forced 7 포함) 전원이 결과를 확보했고 누락은 없다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / api_contract | `assertAuthConfigInWorkspace` 가 top-level 특화 코드(`AUTH_CONFIG_NOT_FOUND`)와 generic `details.code: 'INVALID_FIELD'` 를 동시에 실어, 같은 파일의 기존 관례(`rethrowEndpointPathConflict`: top-level 은 상태 기본값 유지 + `details.code` 에만 사유)와 반대 모양이 됐다. `spec/5-system/2-api-convention.md §5.3` "둘을 겹쳐 쓰지 않는다" 원칙의 유일한 방어 근거가 소스가 아니라 테스트 주석에만 있다. Additive 라 하위 호환 파괴는 없음(WARNING, CRITICAL 아님). | `codebase/backend/src/modules/triggers/triggers.service.ts:1009-1011` | `rethrowEndpointPathConflict` 와 동일하게 `details.code` 를 제거하거나, 이 자리를 예외로 남기려면 소스 코드(테스트 아님)에 근거 주석을 추가. 더 근본적으로는 `2-api-convention.md §5.3` 결정표에 "top-level 이 이미 특화 코드인 경우의 병기" 갈래를 명문화(project-planner 턴). 코드를 되돌릴 필요는 없음. |
| 2 | requirement / documentation [SPEC-DRIFT] | `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1.2 가 여전히 "그 PR 이 머지되기 전까지 이 문단은 '아직 안 실린다' 를 서술할 뿐" 이라는 옛 시제를 유지하는데, 바로 이 PR(`triggers.service.ts:734,745`)이 `chatChannel`/`provider` 두 필드에 `code: ErrorCode.INVALID_FIELD` 배선을 정확히 완료했다. 같은 절의 §5.4.1(375행)·§5.4.1.1(426행)은 이미 시제-중립으로 정정돼 있으나 §5.4.1.2(411-416행) 한 곳만 잔존 — 2라운드 연속 carry-over. 코드는 spec 이 선언한 계약값을 정확히 구현했으므로 옳고, spec 문단의 시제만 낡았다. | `spec/5-system/15-chat-channel.md:411-416` (§5.4.1.2) | 코드는 유지. developer 는 이 문장을 쓴 당사자가 아니므로(자기-반증형 소정정 조건 1 불성립, `#1316` planner 턴이 작성) 직접 고칠 수 없다 — project-planner 턴으로 §5.4.1/§5.4.1.1 과 동일한 "배선 전 관측값 → 배선 완료" 패턴으로 정정 필요. `--impl-done` 실행 전 착지 여부 확인 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / testing / api_contract | `@MinLength(1)` 은 길이만 검사해 공백 전용 문자열(`'   '`)은 여전히 통과 — `SecretResolver.rotate()` 가 provider 검증 전에 먼저 저장되는 경로가 이 값에 대해 잔존. 코드 주석·테스트 JSDoc·CHANGELOG 에 "별개 결정으로 스코프 아웃" 으로 이미 명시된 의도적 유예. | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192` | 별도 트래커 항목으로 trim 정책(`@Transform`+trim 또는 공백-전용 거부) 결정을 남길 것. 이번 PR 을 막을 사유 아님. |
| 2 | security | `SecretResolverService.rotate()`/`store()` 자체가 빈 값을 가드하지 않아, DTO 계층 방어에만 의존하는 구조가 남아 새 호출부가 추가되면 같은 클래스의 결함이 재발할 수 있다(pre-existing, 이번 PR 은 한 호출부만 닫음). | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (`rotate`/`store`, 이번 diff 밖) | 후속 항목으로 `rotate`/`store` 내부에 빈 값(및 공백) 거부를 내재화 권장. |
| 3 | architecture / maintainability | `TriggersService`(1868줄)의 provider-특화 검증 책임 누적이 이번 PR 로도 계속됨(13개 throw 자리에 `code` 필드만 추가, 새 책임 아님). 모듈 경계 추출(E)은 plan 이 후속 PR 로 명시적으로 분리(근거: `forwardRef` 순환 회피). | `codebase/backend/src/modules/triggers/triggers.service.ts` 전체 | 후속 PR(E) 착지만 추적. 이번 PR 의 부채 아님. |
| 4 | maintainability | `chatChannel` 차단 필드 거부의 `BadRequestException` 생성 보일러플레이트(약 10곳)가 여전히 손으로 반복된다 — 이미 message/code 값은 상수화됐으니 예외 생성 자체도 사설 헬퍼로 묶을 여지. | `codebase/backend/src/modules/triggers/triggers.service.ts` (`assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertInboundSigningPlaintextByProvider`) | `rejectBlocked(field)` 형태 헬퍼로 묶어 5개 호출부를 한 줄로 축소하는 급하지 않은 후속 개선. |
| 5 | performance | `[A]`/`[등가성]` 두 `it.each` 블록이 같은 fixture 로 NestJS 테스트 모듈을 10회(5회가 아니라) 재컴파일 — CI 시간에만 영향, 프로덕션 무관. 2라운드 연속 미해소이나 우선순위 낮음. | `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`BLOCKED_FIELD_CASES` 공유 두 `it.each` 블록) | 두 assertion 을 한 `it.each` 로 병합해 컴파일 횟수 절반으로. 비차단. |
| 6 | side_effect / dependency | 신규 상수 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 가 `Readonly` 로 잠겨 있지 않고, `INVALID_FIELD` 값 생산 방식이 파일마다 리터럴/enum 참조로 갈려(`password.util.ts` 는 계층 경계 근거로 의도적 리터럴 유지) 향후 enum 값이 바뀌면 조용히 drift 할 수 있는 구조. 현재는 세 곳 모두 값이 동일해 실제 drift 없음. | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (타입 선언부) / `codebase/backend/src/common/utils/password.util.ts` | 타입을 `Readonly<Record<...>>` 로 바꾸거나 `Object.freeze()` 추가 권장. 급하지 않음. |
| 7 | documentation / user_guide_sync | `triggers.mdx`/`triggers.en.mdx` 에서 이번 PR 이 `chatChannel`/`provider` 두 문장에는 `details.code` 를 추가했으나, 바로 다음 문장(`botToken`/`botTokenRef`)은 그대로 남아 같은 단락 안에서 표기가 불균일해졌다. 이 경로는 이번 PR 이전부터 `code` 를 싣던 pipe 계층이라 신규 회귀는 아니며, plan 의 기존 `I12` 트래커 항목과 같은 판단 축이다. | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:431` / `triggers.en.mdx:420` | 여유가 있으면 같은 turn 에 두 줄 추가해 단락 표기 통일, `I12` 트래커(slack/discord/telegram 6파일)와 함께 처리. 비차단. |
| 8 | testing | "필드 없는 진단 payload(`{errors}`/`{offenders}`/`{reason}`) 는 `code` 를 안 싣는다"는 이 PR 이 세운 스코프 경계를 고정하는 회귀 캐너리가 없다 — 반대 방향(양성 대조)이 주석으로만 지켜지고 있어 다음 PR 이 실수로 `code` 를 얹어도 감지 못함. | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (헤더 주석 "범위 밖" 서술) | `not.toHaveProperty('code')` 류 저비용 캐너리 1개 추가 권장. 비차단. |
| 9 | requirement | `AUTH_CONFIG_NOT_FOUND` top-level 코드 자체가 `spec/5-system/3-error-handling.md` §1 카탈로그·`spec/conventions/error-codes.md` 어디에도 등재돼 있지 않음(pre-existing, 이번 PR 이 만든 것 아님). | `codebase/backend/src/modules/triggers/triggers.service.ts:1009` | 이번 PR 을 막을 사안 아님. 후속 트래커 항목으로 등재 검토. |
| 10 | maintainability | `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 5개 메시지의 문체가 격식체/해요체로 혼재(pre-existing, 이번 PR 은 상수로 모으기만 함). | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` | 필요 시 별도 트래커에 "chatChannel 거부 메시지 문체 통일" 항목. |
| 11 | security | 신규 상수 파일의 사용자 노출 메시지가 내부 API 경로(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)를 그대로 인용하나, 이미 공개된 Swagger 뮤테이션 엔드포인트라 추가 공격 표면 없음. | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` | 조치 불필요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. `@MinLength(1)` 은 오히려 빈 시크릿 조기 저장 결함을 닫는 보안 긍정적 변경. |
| performance | NONE | 전 변경이 O(1)/냉경로. 유일한 관찰은 테스트 모듈 재컴파일 10회(INFO, CI 시간만 영향). |
| architecture | LOW | `authConfigId` 자리의 top-level 코드 + `details.code` 병기가 파일 내 기존 관례와 반대 모양(WARNING). 직전 라운드 WARNING 4건은 전부 해소 확인. |
| requirement | LOW | `[SPEC-DRIFT]` `15-chat-channel.md §5.4.1.2` 옛 시제 잔존(WARNING). 기능 완전성·엣지케이스·spec fidelity 전수 확인, 코드는 정확. |
| scope | NONE | plan 이 선언한 A/B/C/D 4건과 정확히 일치. 계획 밖 항목(모듈 경계 추출 E) 미혼입. |
| side_effect | LOW | `@MinLength(1)` 이 PATCH 로 새지 않음(OmitType 확인). 신규 상태/전역변수/네트워크 없음. 공백-전용 잔여 갭은 이미 스코프 아웃. |
| maintainability | NONE | 직전 2라운드 WARNING 전부 해소 확인. 보일러플레이트 반복·문체 혼재는 INFO. |
| testing | NONE | 뮤테이션 근거(15자리 개별 RED)·fixture 커버리지 캐너리 확인, `npx jest` 재실행 GREEN(211 passed). 회귀 캐너리 공백 1건 INFO. |
| documentation | LOW | `[SPEC-DRIFT]` §5.4.1.2 잔존(WARNING, requirement 와 동일 사안). 직전 라운드 WARNING/INFO 6건은 코드로 재검증해 전부 해소 확인. |
| dependency | NONE | 신규 외부 의존성/lockfile 변경 없음. 내부 import 는 기존 레이어링 선례와 일치. |
| database | NONE | 해당 없음 — 리포지토리/트랜잭션/마이그레이션 변경 없음. |
| concurrency | NONE | 해당 없음 — 공유 가변 상태·락·비동기 흐름 변경 없음. |
| api_contract | LOW | `authConfigId` 병기 WARNING(architecture 와 동일 사안). 나머지 14/15 배선은 §5.3 정규 갈래 준수, 하위 호환 파괴 없음. |
| user_guide_sync | LOW | 2라운드 WARNING(mdx `details.code` 누락)이 이번 diff 안에서 해소 확인. 같은 단락 인접 문장 gap 은 INFO(pre-existing). |

## 발견 없는 에이전트

- database — 해당 없음(DB 접근 코드 변경 없음)
- concurrency — 해당 없음(동시성 관련 코드 변경 없음)

## 권장 조치사항

1. `assertAuthConfigInWorkspace` 자리(`triggers.service.ts:1009-1011`)의 top-level 특화 코드 + `details.code` 병기를 정리 — `rethrowEndpointPathConflict` 와 같은 모양으로 `details.code` 를 제거하거나, 예외로 유지한다면 소스 코드에 근거 주석을 남기고 `2-api-convention.md §5.3` 결정표에 이 갈래를 명문화(project-planner 턴). CRITICAL 은 아니나 이 PR 이 15자리에 균일 적용하려던 규칙의 유일한 예외이므로 최우선 정리 대상.
2. `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md §5.4.1.2`(411-416행)를 §5.4.1/§5.4.1.1 과 동일한 시제-중립 패턴으로 정정하는 project-planner 턴 진행. developer 는 자기-반증형 소정정 조건 불성립으로 직접 고칠 수 없다. `--impl-done` 전 착지 여부 확인.
3. (비차단, 여유 시) `triggers.mdx`/`triggers.en.mdx` 의 `botToken`/`botTokenRef` 문장에도 `details.code` 표기를 추가해 단락 내 일관성 확보, 기존 `I12` 트래커(slack/discord/telegram 6파일)와 함께 처리.
4. (비차단, 후속) `botToken` 공백 전용 문자열(trim 정책) 및 `SecretResolverService.rotate`/`store` 자체의 빈 값 가드 내재화를 별도 트래커 항목으로 등재.
5. (비차단, 후속) "필드 없는 진단 payload 는 `code` 를 안 싣는다"는 스코프 경계를 고정하는 회귀 캐너리 1개 추가.
6. (비차단, 후속) `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 를 `Readonly`/`Object.freeze` 로 런타임 방어하고, `BadRequestException` 생성 보일러플레이트를 사설 헬퍼로 묶는 리팩터를 검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인, 누락 없음.
- 제외된 reviewer 없음(모든 reviewer 가 `ran` 목록에 포함되어 실행됨).
