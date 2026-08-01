STATUS=success 변경 범위(Scope) 검토 완료 — WARNING 1건, INFO 1건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 방법

프롬프트 번들 28개 파일(코드 20 + `review/consistency/2026/08/01/09_11_58/**` 8) 전체를 확인했다. 프롬프트
크기 제한으로 "전체 파일 컨텍스트"가 생략된 파일은 실제 diff 는 이미 unified diff 블록에 전부 담겨 있어
Scope 판단에는 지장이 없었으나, 의심 지점은 `git show`/`git diff -w`/`git log --stat`/`Read` 로 실제
워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/audit-logging`)를 직접 대조해 검증했다.
브랜치는 커밋 3개(`646a0bad4` feat → `24d0db60a` test → `65087584b` style)로 구성되며,
`git diff origin/main...HEAD --stat` 결과 정확히 이 28개 파일과 일치함을 확인해 리뷰 대상 누락이 없음을
검증했다.

## 발견사항

- **[WARNING]** 감사 로깅과 무관한 파일 변경이 "포맷 전용" 커밋에 섞여 유입됨 — 커밋 메시지의 "실질 변경
  0줄" 주장이 이 파일에 한해 사실이 아님
  - 위치: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:105`
  - 상세: 이 파일은 `NotificationConfigDto`(outbound webhook 알림 이벤트 구독 설정)를 다루며 이번 작업
    범위(workflow/trigger/schedule/model_config 의 CRUD 감사 기록)와 아무 관련이 없다 — `AuditLogsService`
    import 도 없고, feat 커밋(`646a0bad4`)·test 커밋(`24d0db60a`) 어디에서도 이 파일을 건드리지 않았다
    (`git show <sha> --stat` 로 확인). 그런데 세 번째 커밋 `65087584b`("style(backend): eslint --fix
    포맷 정정")가 이 파일의 `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], { each: true })` 를
    `@IsIn(NOTIFICATION_EVENT_TYPES, { each: true })` 로 바꿨다 — `as unknown as string[]` 타입 단언
    제거다. 커밋 메시지는 "`const duplicated = await` 추가로 줄이 길어져 prettier 가 duplicate 트랜잭션
    본문을 재래핑했다. `git diff -w` 로 실질 변경 0줄 확인 — 포맷만." 이라 주장하지만, 직접
    `git diff -w 24d0db60a 65087584b -- .../notification-config.dto.ts` 를 실행하면 이 hunk 는 `-w`
    에서도 그대로 남는다(공백만의 차이가 아니라 실제 토큰이 삭제됐다는 뜻) — 검증 실행 자체가 이
    파일에는 적용되지 않았거나 결과를 놓친 것으로 보인다. 타입 단언은 컴파일 타임에만 존재하고
    런타임에는 아무 효과가 없어(트랜스파일 후 두 표현은 동일한 JS) 기능적 위험은 없지만, "무관한
    파일·무관한 변경"이 스코프 밖으로 유입된 사실 자체는 남는다. 근본 원인은 `codebase/backend/eslint.config.mjs`
    의 `@typescript-eslint/no-unnecessary-type-assertion` 규칙 주석에 있다 — 이 규칙은 의도적으로
    `'warn'`(차단 아님)으로 유지되며, 그 이유를 "opt-in 정리는 `pnpm --filter backend lint:fix`" 로 명시한다
    (일반 `lint` 게이트와 분리된, 별도로 수행해야 할 정리 작업이라는 뜻). 이번 커밋에서 `lint:fix`(또는
    `eslint --fix`)를 정확히 변경된 파일 목록이 아니라 **모듈 디렉터리 단위**(`triggers/**`)로 돌린 것으로
    보인다 — 그 결과 같은 디렉터리에 있지만 이번 기능과 무관한 `dto/notification-config.dto.ts` 의
    기존 lint 부채(프로젝트 전체 281건 중 1건, 주석에 명시된 수치)가 이번 PR 에 무관하게 끼어들었다.
    같은 커밋이 건드린 나머지 8개 파일(model-config.controller.spec.ts 등)의 재포맷은 전부
    `git diff -w` 로 실제 0줄임을 재확인했다 — 이 1개 파일만 예외다.
  - 제안: 이 hunk 를 되돌리거나(범위 엄격 준수) 별도의 독립 커밋(`style: 불필요한 타입 단언 제거` 등,
    이번 audit-logging PR 과 분리)으로 분리해 커밋 메시지가 실제로 무엇을 바꿨는지 정확히 반영하게 한다.
    향후 유사 "포맷 정정" 커밋에서는 `lint:fix`/`eslint --fix` 실행 범위를 이번 diff 로 변경된 **파일
    목록**으로 한정(디렉터리 단위 X)하고, "0줄 확인"류 주장은 실제로 영향받은 모든 파일에 대해
    `git diff -w --stat` 로 재확인한 뒤 커밋 메시지에 적을 것.

- **[INFO]** 신규 감사 로깅 테스트에 죽은 코드(미사용 변수) — 주석이 실제 동작과 어긋남
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2167-2170`
    (`describe('TriggersService — 감사 로깅 (trigger.*)')` 의 `beforeEach` 블록)
  - 상세:
    ```ts
    // createBaseProviders 는 모듈 레벨이라 공유 mock 을 못 받는다 — 여기서 override.
    const idx = moduleRef as unknown as {
      container?: unknown;
    } as unknown as never;
    void idx;
    ```
    `idx` 는 이중 `unknown`→`never` 캐스팅 뒤 바로 `void idx;` 로 버려져 어떤 동작도 하지 않는다.
    주석은 "여기서 override" 라고 말하지만 실제 override(재주입된 `AuditLogsService` 인스턴스를 다시
    가져오는 것)는 4줄 뒤 `auditLogs = moduleRef.get(AuditLogsService) as unknown as {...}` 에서
    일어난다 — 이 4줄은 탐색적 코딩 중 시도했다가 폐기된 흔적으로 보이며, feat 커밋(`646a0bad4`)에서
    새로 추가된 코드(`+` 라인)다. 프로덕션 코드가 아니라 테스트 파일에 한정되고 테스트 통과 여부에
    영향을 주지 않아 CRITICAL/WARNING 은 아니지만, 리뷰 시점에 "왜 있는지" 를 되묻게 만드는 잔여물이다.
  - 제안: 4줄(`const idx = ...` ~ `void idx;`)을 삭제하고 주석("여기서 override")을 실제 override 지점인
    `auditLogs = moduleRef.get(AuditLogsService) ...` 줄로 옮긴다.

## 점검했으나 문제 없음으로 판단한 지점 (참고)

- **`workflows.service.ts` `duplicate()` 의 대규모 재인덴트**(약 190줄 변경 표시): `const duplicated =
  await this.dataSource.transaction(...)` 로 감싸며 줄 길이가 길어져 prettier 가 트랜잭션 콜백 전체를
  재래핑한 결과다. `git diff -w 24d0db60a 65087584b -- .../workflows.service.ts` 로 직접 대조한 결과
  남는 변경은 시그니처 한 줄 축약(`async remove(...)`)과 `manager.insert(...)`/`condition: ...` 두 곳의
  줄바꿈 스타일 변경뿐이며, 토큰·로직 변경은 전혀 없다 — 커밋 메시지의 설명과 정확히 일치한다. 대량의
  diff 노이즈이지만 감사 로깅 기능 추가(`const duplicated` 캡처 + 커밋 후 `recordAudit` 호출)의 직접적·
  불가피한 부산물이라 "불필요한 리팩토링"에 해당하지 않는다.
- **`review/consistency/2026/08/01/09_11_58/**` 8개 파일 신규 추가**: `CLAUDE.md` 가 developer 역할에게
  구현 착수 직전 `consistency-check --impl-prep` 실행을 의무화하고, 그 산출물 저장 위치를
  `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 명시한다 — 이번 PR 이 바로 그 게이트 산출물을
  구현 커밋과 함께 커밋한 것으로, 요구된 프로세스의 정상적 일부다. Scope 위반이 아니다.
  (참고: 해당 리포트들이 후속 권장사항으로 남긴 spec 동기화 항목들 — `data-flow/1-audit.md §1.1`,
  `1-auth.md §4.1`, `conventions/audit-actions.md §3` 갱신 — 은 이번 diff 에 없지만, 이는 "범위 밖 항목이
  섞여 들어옴"이 아니라 반대로 "완료 후 갱신 예정인 항목이 아직 없음"이라 Scope 리뷰(불필요한 추가 탐지)
  대상이 아니다.)
- **컨트롤러 4곳(`model-config`/`schedules`/`triggers`/`workflows`)의 `@CurrentUser('sub') userId` 추가와
  각 모듈의 `AuditLogsModule` import**: 감사 기록의 행위자(userId) 전달 및 `AuditLogsService` DI 배선에
  직접 필요한 최소 변경이며 기존 코드 스타일(`WorkspaceId` 옆에 나열)과 일치한다. 신규 추상화나 공용
  베이스 클래스를 도입하지 않고 각 서비스에 동일 패턴(`private recordAudit(...)`)을 반복 적용한 점도
  기존 관례(`auth-configs` 의 named-field 패턴)를 그대로 따른 것으로, over-engineering 이 아니다.
- **각 spec 파일에 `{ provide: AuditLogsService, useValue: {...} }` mock 을 반복 주입**한 것은 신규
  생성자 의존성이 추가된 데 따른 필연적 보일러플레이트이며(주입 안 하면 DI 컴파일 실패), 불필요한
  변경이 아니다.
- 임포트·설정 파일(`package.json`, `eslint.config.mjs`, `tsconfig*`, CI 설정 등) 변경 0건 확인 — 관점
  7(임포트)·8(설정)에 해당하는 위반 없음(위 WARNING 의 `notification-config.dto.ts` 는 임포트가 아니라
  데코레이터 인자에서 타입 단언을 제거한 것).

## 요약

이번 PR 은 스코프 통제가 전반적으로 매우 양호하다 — 신규 액션 상수(`audit-action.const.ts`), 4개
모듈(model-config/schedules/triggers/workflows)의 controller→service 배선과 `recordAudit` 헬퍼, 그에
대응하는 테스트만으로 변경이 정확히 좁혀져 있고, 대형 diff 로 보이는 `workflows.service.ts` 의
`duplicate()` 재포맷도 실제로는 `git diff -w` 로 0줄 확인되는 순수 부산물이다. 다만 세 번째(포맷 정정)
커밋에서 감사 로깅과 전혀 무관한 `triggers/dto/notification-config.dto.ts` 의 기존 타입 단언 부채 1건이
함께 정리되어 유입됐고, 그 커밋 메시지의 "실질 변경 0줄" 검증 주장은 이 파일에 대해서는 사실이 아니다
(런타임 위험은 없지만 스코프·커밋 메시지 정확성 문제). 부수적으로 신규 테스트 파일에 동작 없는 죽은
코드 4줄이 남아 있다. 두 건 모두 되돌리기 쉬운 소규모 수정이며 기능적 리스크는 낮다.

## 위험도

LOW
