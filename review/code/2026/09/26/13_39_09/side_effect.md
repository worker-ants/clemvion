# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** e2e 신규 테스트가 raw SQL 로만 정리하고 workspace/workflow/user 는 정리하지 않는다
  - 위치: `codebase/backend/test/advertised-response-contract.e2e-spec.ts:51`~`58` (`afterAll`)
  - 상세: `afterAll` 이 생성된 `trigger` row 만 `DELETE FROM trigger WHERE id = $1` (raw SQL, 서비스 레이어 우회)로 지우고, `beforeAll` 에서 만든 user·workspace·workflow 는 정리하지 않는다. 서비스 레이어(`TriggersService.remove`)를 거치지 않으므로 정상 삭제 흐름이 수행할 부가 부작용(예: 관련 secret/자식 row 정리)이 생략된다. 다만 이 패턴은 이 PR 이 새로 만든 것이 아니라 저장소 e2e 관례 그대로다 — 동일 디렉터리의 `chat-channel-discord.e2e-spec.ts`·`webhook-endpoint-reservation.e2e-spec.ts`·`chat-channel-trigger-create.e2e-spec.ts`·`trigger-config-lost-update.e2e-spec.ts`·`chat-channel-slack.e2e-spec.ts` 모두 같은 raw `DELETE FROM trigger` 관례를 쓰고, `trigger-workflow-ref.e2e-spec.ts:145,152` 는 이 관례가 "고아 row 를 남긴다"는 점까지 이미 문서화해 뒀다. 새 위험을 도입한 것은 아니고 기존 관례를 그대로 따른 것.
  - 제안: 신규 리스크는 아니므로 차단 사유는 아니다. 다만 이 파일이 만드는 user/workspace/workflow 는 다른 e2e 파일들과 마찬가지로 컨테이너 재생성 전까지 누적된다 — 기존 관례를 넘어서는 정리(예: workspace 삭제)까지 하려면 별도 후속 작업으로 트래킹할 것.

- **[INFO]** 내부 테스트 전용 인터페이스에 필드 추가(`HttpStatusScan`) — 외부 소비자 없음 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` — `judgeHandler` 반환 타입(약 219~224번째 줄 부근)과 `HttpStatusScan` interface(약 156~168번째 줄 부근)
  - 상세: `judgeHandler` 의 반환 객체와 `HttpStatusScan` 에 `unadvertised` 필드가 추가됐다. 형태상 함수/인터페이스 "시그니처 변경"에 해당하지만, `grep -rn "scanHttpStatusAdvertised|HttpStatusScan" codebase/backend/src` 로 확인한 결과 소비자는 같은 파일과 `http-status-advertised.spec.ts` 뿐이며, 그 spec 은 `.violations`/`.unresolved`/`.unadvertised`/`.checked` 필드를 개별 접근하지 전체 객체를 `toEqual` 로 엄격 비교하지 않으므로 추가된 필드로 인한 회귀는 없다.
  - 제안: 정보성 기록. 향후 이 guard 유틸을 다른 스크립트가 import 하게 되면 이 인터페이스 확장을 인지하도록 참고.

- **[INFO]** Swagger 데코레이터 추가는 런타임 상태 코드에 영향 없음(확인됨) — 부작용 아님
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (`webauthnAvailability`, `webauthnDelete`), `codebase/backend/src/modules/external-interaction/interaction-stream.controller.ts:64`, `codebase/backend/src/modules/triggers/triggers.controller.ts:215`,`:246`, `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:72`,`:95`,`:116`,`:133`,`:150`,`:167`
  - 상세: 모두 `@ApiOkWrappedResponse`/`@ApiOkWrappedNullableResponse`/`@ApiNoContentResponse`/`@ApiOkResponse` 를 새로 붙인 것으로, 이번 PR 이 검증하는 대로(`http-status-advertised-guard.ts` 의 근거 캐너리) Swagger `Api*Response` 데코레이터는 OpenAPI 문서 메타데이터만 등록하고 실제 HTTP 상태 코드·응답 바디에는 영향을 주지 않는다. 각 핸들러의 실제 `@HttpCode`/기본값과 대조해도 문서·실제가 일치해(`webauthnDelete` 는 이미 `@HttpCode(HttpStatus.NO_CONTENT)`, `webauthnAvailability` 는 `@HttpCode(HttpStatus.OK)`) 부작용 없음을 직접 확인했다.
  - 제안: 없음(정상).

## 요약
이번 변경은 11개 라우트에 대해 "성공 응답을 광고하지 않던" Swagger 데코레이터·DTO를 추가하고, 이를 검증하는 정적 가드(`http-status-advertised-guard.ts`)에 `unadvertised` 판정을 더하고, e2e 계약 테스트를 신설한 작업이다. 프로덕션 코드 변경분은 전부 순수 함수 추가(`wrapNullableDataSchema`, `ApiOkWrappedNullableResponse`)와 데코레이터 부착으로, 기존 함수 시그니처·전역 상태·환경 변수·네트워크 호출·이벤트/콜백에는 손대지 않았다. 내부 테스트 전용 인터페이스(`HttpStatusScan`)에 필드가 추가됐으나 외부 소비자가 없어 파급 효과가 없음을 직접 확인했다. 신규 e2e 스펙(`advertised-response-contract.e2e-spec.ts`)은 실제 DB write/raw-SQL delete 를 수행하지만 이는 저장소 e2e 전반에 이미 퍼져 있는 관례를 그대로 따른 것으로, 이 PR 이 새로 만든 위험은 아니다. 전반적으로 관측된 부작용은 모두 기존 관례 재사용 수준이며 차단 사유가 되는 CRITICAL/WARNING 은 없다.

## 위험도
LOW
