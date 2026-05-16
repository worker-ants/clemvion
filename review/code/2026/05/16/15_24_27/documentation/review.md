# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `Cafe24PrecheckQueryDto` JSDoc 이 기능 배경을 충실히 설명하나 `@param`/`@returns` 태그 미사용
  - 위치: `backend/src/modules/integrations/dto/integration.dto.ts` — 추가된 클래스 JSDoc (라인 36–43)
  - 상세: 클래스 수준 주석은 양호하나 NestJS DTO 의 유사 패턴과 달리 `@example`/`@see` 태그가 없다. 실제로는 `@ApiProperty` 데코레이터에 `example` 필드가 있어 Swagger 레이어에서 커버되므로 누락이 치명적이지는 않다.
  - 제안: 현행 유지 가능. 필요 시 `@see spec/2-navigation/4-integration.md#92` 링크 추가 정도면 충분.

- **[INFO]** `Cafe24PrecheckResultDto` JSDoc 에서 상태 우선순위 (`connected > pending_install > error > expired`) 를 명시하고 있어 가독성이 좋으나, 실제 서비스 구현의 `PRIORITY` 배열 순서와 일치하는지 별도 확인이 필요
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — 추가된 클래스 JSDoc (라인 81–90)
  - 상세: DTO 주석의 우선순위 문자열 `connected > pending_install > error > expired` 와 `integration-oauth.service.ts` 의 `PRIORITY` 배열 `['connected', 'pending_install', 'error', 'expired']` 가 동일해 정합. 다만 두 곳에 중복 기술되어 있어 서비스 로직이 바뀔 때 DTO 주석을 함께 갱신해야 한다는 점은 유지보수 부담.
  - 제안: DTO 주석에 "서비스 구현의 PRIORITY 배열과 동일" 이라는 한 줄 참조를 추가하거나, 우선순위 배열을 상수로 내보내어 두 파일이 같은 소스를 참조하도록 하면 중복 제거 가능.

- **[WARNING]** 컨트롤러 라우트 순서 관련 주석이 코드 안에만 존재하고 API 문서(Swagger `@ApiOperation`)에는 미반영
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` — `cafe24/precheck` 라우트 선언 앞 블록 주석 (라인 590–595)
  - 상세: NestJS 라우트 매칭 우선순위 트랩(`cafe24/precheck` vs `:id`)은 빌드 타임에 탐지되지 않는 잠재적 회귀 지점이다. 현재 인라인 주석으로 설명하고 "향후 리팩토링 시 본 주석을 보존할 것"이라고 명시한 점은 좋다. 그러나 e2e 테스트에서 이미 라우트 순서 회귀를 검증하고 있음에도, 주석과 테스트 케이스 이름이 같은 내용을 두 곳에 중복 서술하고 있다.
  - 제안: 컨트롤러 주석은 유지하되, `@ApiOperation.description` 에 짧게 "Note: declared before `:id` route — see controller comment" 정도의 힌트를 추가하면 Swagger 문서 열람자에게도 의도가 전달된다.

- **[WARNING]** `throwIfUniqueViolation` 에 추가된 인라인 주석이 spec 경로를 명시하지 않는 기존 주석들과 스타일이 다름
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `throwIfUniqueViolation` 내부 신규 분기 (라인 733–745)
  - 상세: 기존 분기(`integration_workspace_name_unique`)에는 별도 주석이 없고 코드만 존재하는 반면, 신규 분기에는 `spec/2-navigation/4-integration.md §9.4` 참조를 포함하는 장문 주석이 붙어 있다. 팀 컨벤션이 확립되지 않은 상태라 괜찮을 수 있으나, 기존 분기에는 동일 수준의 주석이 없어 비대칭이다.
  - 제안: 신규 분기 주석은 양호하므로 그대로 유지. 기존 분기에도 간단한 주석(예: `// spec §9.4 INTEGRATION_NAME_TAKEN`)을 추가하면 대칭성 확보.

- **[INFO]** `precheckCafe24Mall` 서비스 메서드 JSDoc 에서 노출 제한("Never exposes credentials/tokens/timestamps") 을 명시한 점은 보안 의도 문서화로 우수하나, 반환 타입이 인라인 객체 리터럴로 정의되어 있어 `Cafe24PrecheckResultDto` 와의 연결이 문서 레이어에서는 보이지 않음
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` — `precheckCafe24Mall` JSDoc (라인 484–496)
  - 상세: 서비스 메서드 반환 타입이 `Promise<{ conflict: boolean; existingIntegrationId?: string; ... }>` 의 인라인 타입으로 선언되어 있고, 컨트롤러는 이를 `Cafe24PrecheckResultDto` 로 래핑한다. JSDoc 에 `@returns {Cafe24PrecheckResultDto}` 또는 해당 DTO 와의 관계를 언급하면 연결성이 명확해진다.
  - 제안: JSDoc 에 `@see Cafe24PrecheckResultDto` 태그 추가. 또는 반환 타입을 인라인에서 `Cafe24PrecheckResultDto` 타입으로 변경하면 타입 레이어에서 자동으로 연결된다.

- **[WARNING]** plan 파일(`cafe24-mall-dup-ux.md`)의 진행 상태 체크박스가 실제 구현 완료 여부와 불일치
  - 위치: `plan/in-progress/cafe24-mall-dup-ux.md` — `## 진행 상태` 섹션 (라인 706–715)
  - 상세: diff 에서 Backend (1)(2)(3)과 Frontend (4)의 구현 코드가 모두 포함되어 있음에도, plan 체크박스에는 이 항목들이 여전히 `[ ]` (미완료)로 표시되어 있다. CLAUDE.md 의 PLAN 문서 라이프사이클 규약에 따르면 작업 단계가 끝날 때마다 plan 문서를 갱신해야 한다.
  - 제안: 구현이 완료된 Backend (1)–(3), Frontend (4) 체크박스를 `[x]`로 갱신하고, 남은 TEST, REVIEW, Spec 위임 항목만 `[ ]`로 남겨야 한다. 리뷰 시점에서 아직 미완료라면 별도 명시 필요.

- **[INFO]** `spec-update-cafe24-public-dup-guard.md` plan 파일이 spec 변경 요청을 잘 구조화하고 있으나, 해당 spec 변경이 적용되기 전까지 코드 내 `spec/2-navigation/4-integration.md §9.2` 참조가 문서와 구현이 앞서가는 상태임을 표시하는 수단이 없음
  - 위치: `plan/in-progress/spec-update-cafe24-public-dup-guard.md`
  - 상세: 코드의 여러 주석/JSDoc이 spec §9.2 Rationale "precheck endpoint" 등을 참조하고 있으나, 해당 spec 변경은 아직 project-planner 위임 전 상태이다. spec 과 코드 간 일시적 불일치가 발생한다.
  - 제안: plan 파일에 "spec 갱신 완료 전까지 코드 참조가 미래 상태를 가리킴" 임을 한 줄 명시. 또는 spec PR 과 코드 PR 을 함께 병합하는 것이 이상적이다.

- **[INFO]** `frontend/src/lib/api/integrations.ts` 의 `cafe24Precheck` 메서드 JSDoc 과 `Cafe24PrecheckResult` 인터페이스는 양호한 수준이나, 인터페이스가 파일 말미 `export` 바로 아래에 선언되어 있어 관련 타입들(`AuthVariant`, `ServiceDefinition` 등)과 분리되어 있음
  - 위치: `frontend/src/lib/api/integrations.ts` — 파일 말미 `Cafe24PrecheckResult` 인터페이스
  - 상세: 기존 타입 정의가 파일 상단부에 집중되어 있는데 `Cafe24PrecheckResult` 만 파일 끝에 위치하여 일관성이 떨어진다. 문서화 문제라기보다 구조 문제이나, 파일을 읽는 개발자가 타입을 찾기 어렵다.
  - 제안: 다른 exported 인터페이스들과 같은 위치(파일 상단 타입 정의 구역)로 이동.

- **[INFO]** i18n 사전 파일(`en/integrations.ts`, `ko/integrations.ts`)에 주석으로 날짜(`2026-05-16`)와 기능명을 구분선과 함께 표시한 점은 맥락을 제공하는 좋은 관행이나, 일부 영어 키가 한국어 주석으로만 설명되어 있음
  - 위치: `frontend/src/lib/i18n/dict/ko/integrations.ts` — `cafe24DuplicateMallToast` 키 위 주석 (라인 1623)
  - 상세: `// 사후 toast 의 한글 primary 메시지. backend 영문 message 는 (괄호) 안에 보조 표시.` 주석이 ko 파일에만 있고 en 파일에는 없다. en 파일에는 동일한 사용 의도를 영어로 설명하는 주석이 없어서 영어권 개발자가 `cafe24DuplicateMallToast` 키의 동작(괄호 안 보조 메시지 패턴)을 이해하기 위해 소스를 추가로 탐색해야 한다.
  - 제안: `en/integrations.ts` 에도 `// Post-action toast primary. Backend English message is appended in parentheses as secondary info.` 주석 추가.

- **[INFO]** e2e 스펙 파일(`integration-cafe24-precheck.e2e-spec.ts`)의 상단 JSDoc이 테스트 대상·보호 케이스를 체계적으로 나열하고 있어 우수함. 단, `insertCafe24Row` 헬퍼 함수에 인라인 주석이 길고 반복적인 `// precheck endpoint 는 ...` 설명이 들어 있어 함수 레벨 JSDoc으로 올리는 것이 더 명확할 것
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts` — `insertCafe24Row` 함수 (라인 818–840)
  - 상세: 함수 내부 인라인 주석이 4줄에 걸쳐 설명하는 내용을 함수 직전 JSDoc 블록으로 이동하면 독자가 함수를 호출하기 전에 제약 조건을 파악할 수 있다.
  - 제안: `insertCafe24Row` 앞에 JSDoc 추가 (`/** 직접 DB INSERT로 cafe24 row 생성. precheck endpoint는 credentials를 읽지 않으므로 빈 객체({})로 충분. OAuth 시뮬레이션 불필요. */`).

- **[INFO]** README 업데이트 필요성 검토 — 새 API 엔드포인트(`GET /api/integrations/cafe24/precheck`) 와 throttle 정책 추가에도 불구하고 루트 README 또는 backend README 에 변경 사항이 반영될 필요가 있는지 확인 필요
  - 위치: 프로젝트 루트 `README.md` 또는 `backend/README.md`
  - 상세: 본 PR 에서 README 변경이 없다. 프로젝트 README 가 API 레퍼런스를 나열하지 않는 구조라면 업데이트 불필요. 다만 CLAUDE.md 는 "구현 완료 후 변동 사항이 있을 경우 spec 을 참고해 README 를 다시 정리" 하도록 규정한다.
  - 제안: README 가 API 목록을 관리하지 않는다면 무시 가능. 관리한다면 `cafe24/precheck` 엔드포인트 한 줄 추가 필요.

- **[INFO]** CHANGELOG 업데이트 — 이 변경은 사용자 경험에 직접 영향을 주는 UX 버그 수정 (Public begin 흐름의 500 오류 → 409 전환) 과 신규 사전 감지 기능을 포함하므로 CHANGELOG 기록 대상임
  - 위치: 프로젝트 루트 `CHANGELOG.md` (존재 여부 미확인)
  - 상세: CHANGELOG 파일이 프로젝트에서 관리된다면 `Fixed: Cafe24 public-flow begin duplicate not guarded (500 → 409)` 및 `Added: cafe24/precheck endpoint for inline mall_id duplicate detection` 항목이 필요하다.
  - 제안: 프로젝트에 CHANGELOG 가 있다면 위 두 항목을 추가. 없다면 해당 없음.

## 요약

전반적으로 이번 변경에서 문서화 품질은 양호하다. 새로 추가된 DTO 클래스(`Cafe24PrecheckQueryDto`, `Cafe24PrecheckResultDto`), 서비스 메서드(`precheckCafe24Mall`, `findAllCafe24RowsForMall`, `findConnectedCafe24MallIntegration`), 프론트엔드 API 클라이언트 메서드(`cafe24Precheck`) 모두 목적·제약·spec 참조를 명시한 JSDoc 이 제공된다. 컨트롤러의 NestJS 라우트 순서 트랩에 대한 경고 주석과 e2e 테스트 파일의 상단 JSDoc 도 우수하다. 다만 plan 파일(`cafe24-mall-dup-ux.md`)의 체크박스가 실제 완료된 구현을 반영하지 않아 CLAUDE.md 규약과 불일치하고(WARNING), 서비스 내 우선순위 로직이 DTO 주석과 두 곳에 중복 기술되어 있어 유지보수 시 불일치 위험이 있다(WARNING). i18n 파일 간 주석 대칭 누락, `Cafe24PrecheckResult` 인터페이스의 위치 불일치, CHANGELOG/README 업데이트 필요 여부 확인 등은 INFO 수준의 권고로 정리한다. spec 갱신이 코드보다 후행하는 일시적 상태는 `spec-update-cafe24-public-dup-guard.md` plan 파일로 추적되고 있어 구조적으로 관리되고 있다.

## 위험도

LOW
