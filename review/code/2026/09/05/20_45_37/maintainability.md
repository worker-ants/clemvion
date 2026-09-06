# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `sanitizeForResponse()` 안에 구조가 거의 동일한 strip 루프가 두 번 반복된다 (기존에 이미 인지·유예된 항목).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:595-598`(`for (const [key, value] of Object.entries(cfg.chatChannel)) { if (CHAT_CHANNEL_RESPONSE_STRIP_KEYS.has(key)) continue; sanitizedChatChannel[key] = value; }`) 와 `:611-616`(같은 형태, `NOTIFICATION_SIGNING_STRIP_KEYS`/`sanitizedSigning`).
  - 상세: 두 블록 모두 "허용목록 밖 키를 걸러 새 객체에 복사" 라는 동일한 패턴을 반복한다. 다만 `chatChannel` 쪽은 루프 뒤에 `hasBotToken` 파생 필드를 추가로 주입하고 `signing` 쪽은 그러지 않아 완전히 동일한 함수는 아니다 — 이 차이가 이미 이전 라운드에서 "두 축의 후처리가 다르다" 는 근거로 조치 불요 처리된 이력이 있다(`review/code/2026/09/05/19_08_18/RESOLUTION.md` INFO#8). 그 판단 자체는 합리적이지만, 공통 부분(`stripKeys(obj, denylist)` 형태의 헬�터로 필터링만 추출하고 `hasBotToken` 주입은 호출부에서 별도로 하는 방식)을 뽑아내면 4줄짜리 반복이 사라지고 세 번째 strip 대상이 생겼을 때도 같은 패턴을 또 손으로 베끼지 않아도 된다. 지금 당장 위험하지는 않다.
  - 제안: 즉시 조치는 불필요(이미 트리아지됨). 세 번째 strip 대상이 생기는 시점에 공용 헬퍼 추출을 고려할 것.

- **[INFO]** `SchedulesController.toResponse()` 의 지역 변수명이 파일의 다른 코드와 비교해 유독 축약돼 있다 (기존에 이미 인지·유예된 항목).
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68` (`const t = schedule.trigger;`), 사용처 `:71-77`.
  - 상세: 이 메서드는 이 PR 의 핵심 보안 목적(조인된 Trigger 엔티티 전체가 새 나가던 것을 참조 4필드로 좁힘)을 담당하는 자리이고, 바로 위 JSDoc 은 배경을 상세히 설명한다. 그런데 본문 핵심 변수는 `t` 로만 표기돼 짧은 스코프(13줄)임에도 가독성이 한 단계 떨어진다. 이미 `review/code/2026/09/05/18_23_02/maintainability.md` 에서 지적되고 "이월"로 유예된 항목이 이번 라운드에도 그대로 남아 있다.
  - 제안: `t` → `trigger` 로 변경(같은 스코프 안에 타입 `Trigger` 의 값 바인딩과 이름이 겹치지만 값/타입 네임스페이스가 달라 충돌 없음).

- **[INFO]** "이미 응답에 실려 나가고 있었다 …" 로 시작하는 동일한 배경 설명 주석 블록이 4개 DTO 파일에 거의 그대로 반복된다 (기존에 이미 인지·유예된 항목).
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-61`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-124`, `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-99`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:69-75`.
  - 상세: 코드 중복이 아니라 설명 주석의 중복이라 당장의 실행 위험은 없다. 다만 이 서사(§5.4 스윕 경위, `@ApiPropertyOptional` 이 "상시 존재" 와 모순되는 이유)를 나중에 정정해야 할 일이 생기면 4곳을 일일이 찾아 동기화해야 한다. `review/code/2026/09/05/18_23_02/maintainability.md` 가 이미 이 항목을 지적했고, 각 DTO 가 파일별 고유 정보(FE 참조 수 등)도 함께 담고 있어 완전한 추출은 어렵다는 이유로 조치가 유예됐다 — 이번 라운드에도 같은 형태로 남아 있다.
  - 제안: 즉시 조치 불필요. 이 서사를 정정할 일이 생기면 4곳 전체를 grep 으로 찾아 동기화할 것.

- **[INFO]** 신규 함수 `findOptionalNullableResponseFields` 에서 소유 클래스명을 못 찾을 때의 대체 문자열이 이름 없는 리터럴로 두 번 반복된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:293-295` (`const owner = ts.isClassDeclaration(node.parent) ? (node.parent.name?.getText(sf) ?? '?') : '?';`).
  - 상세: 익명 클래스 표현식이나 `export default class { ... }` 처럼 클래스에 이름이 없는(현실적으로 응답 DTO 파일에서는 거의 없는) 극단적인 경우를 위한 폴백이 `'?'` 라는 매직 문자열로 두 곳에 하드코딩돼 있다. 실질 영향은 거의 없지만(응답 DTO 클래스는 항상 `export class XxxDto` 형태), 같은 상수를 두 번 타이핑한 것이라 다음에 폴백 표기를 바꾸려면 두 곳을 함께 고쳐야 한다.
  - 제안: `const UNKNOWN_OWNER = '?';` 같은 이름 있는 상수로 뽑아 두 자리에서 재사용. 사소하여 이번 PR 을 막을 사유는 아니다.

## 요약

이번 변경(§5.4 응답-계약 검증자를 4→18개 DTO 로 배선 + 트리거 회전 secret 유출 수정 + DTO 선언 보정 23필드 + 금지-조합 래칫 신설)은 여러 라운드의 코드·일관성 리뷰를 거치며 이미 상당히 다듬어진 상태다. 직접 `git diff origin/main HEAD` 로 실제 프로덕션 코드(트리거/스케줄 서비스·컨트롤러, 5개 DTO, 응답-계약 검증자 본체, 신규 래칫 가드)를 대조한 결과, 이전 라운드에서 지적됐던 실질적 결함들 — `sanitizeForResponse` 의 죽은 이중 순회, CHANGELOG 소제목-표 수치 불일치(24→23), `chatChannelHealth`/`notificationHealth`/`rerankMode` 의 누락된 `enum`, rename 후 stale 주석 — 은 모두 실제로 정정된 상태임을 확인했다. `response-contract.ts` 의 `visit`/`descend`/`visitUnion`, `contractForDto`/`buildContractForDto` 메모이제이션, `sanitizeForResponse` 는 각각 함수 길이·중첩 깊이가 적절하고, 결정의 배경(왜 `select:false` 를 안 썼는지, 왜 서비스가 아니라 컨트롤러에서 좁히는지, 왜 진행 중 promise 를 캐시하는지)이 인접 JSDoc 으로 잘 남아 있어 가독성이 높다. 남은 지적은 전부 이전 라운드에서 이미 발견·유예된 소소한 항목(축약 변수명 `t`, DTO 배경 주석 4파일 반복, strip 루프 2회 반복)의 재확인이거나, 이번에 새로 발견한 매우 사소한 매직 문자열(`'?'` 폴백) 하나뿐이다. 실행 경로에 영향을 주는 새로운 결함은 없다.

## 위험도

LOW
