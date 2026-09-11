# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규 파일, 318줄) — 핵심 검토 대상
- `codebase/backend/src/modules/triggers/triggers.service.ts` (diff만 — private 메서드 6개 제거 + import 로 대체) — diff 확인 + `Bash grep` 으로 이관 후 잔여 `this.*` 호출 0건 검증 완료
- `plan/in-progress/impl-chat-channel-binder.md` — 코드가 아니라 작업 계획 문서라 유지보수성 관점 발견사항 없음(참고만)
- `review/consistency/2026/09/11/14_59_33/*` (SUMMARY.md, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`) — 이번 세션이 생성한 리뷰 산출물(리포트/상태 파일)이며 애플리케이션 코드가 아니므로 유지보수성 코드 리뷰 대상에서 제외

이 PR 은 plan 문서가 명시한 대로 **순수 이동(behavior-preserving move)** 이다 — `triggers.service.ts` 에서 `this.*` 를 하나도 안 쓰는 6개 private 메서드를 module-level 순수 함수로 뽑아 신규 파일로 옮기고, 호출부만 `this.X(...)` → `X(...)` + import 로 바꿨다. `grep` 으로 확인한 결과 `triggers.service.ts` 안에 제거된 메서드에 대한 잔여 `this.` 호출은 0건 — 이관이 깨끗하다.

## 발견사항

- **[WARNING]** `BadRequestException({ code: 'VALIDATION_ERROR', message, details: { field, code: ErrorCode.INVALID_FIELD } })` 구성 패턴이 한 파일 안에서 7회 이상 거의 동일하게 반복된다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:98-102`, `:105-109`, `:112-116`(`assertChatChannelInputSafe`), `:143-147`, `:150-157`(`assertPatchCarriesNoSecrets`), `:235-243`, `:254-262`, `:268-276`, `:279-288`(`assertInboundSigningPlaintextByProvider`)
  - 상세: 코드/메시지/필드명만 다르고 봉투 형태(`code: 'VALIDATION_ERROR'`, `details.field`, `details.code: ErrorCode.INVALID_FIELD`)는 동일한 `throw` 블록이 이 파일 하나에만 7곳 이상 나타난다. 이 파일 자체 docstring 이 "위반 시 던지는 에러 봉투 형태(`details.field`·`details.code`)까지 정한다"고 스스로 그 형태를 계약으로 선언하고 있어서, 반복 코드가 곧 그 계약을 지키는 유일한 장치다 — 신규 필드를 추가하는 사람이 이 중 한 곳만 보고 복붙하다 `details.code` 를 빠뜨리면 컴파일 타임에 안 잡히고 계약이 조용히 깨진다. 이번 PR 은 이 6개 함수를 옮기기만 했을 뿐 새로 만든 중복은 아니지만(`triggers.service.ts` 에도 그대로 있었음), 한 파일로 모인 지금이 추출 비용이 가장 낮은 시점이다.
  - 제안: `throwValidationError(field: string, message: string, code = ErrorCode.INVALID_FIELD)` 같은 헬퍼로 봉투 생성을 한 곳에 모으면 7곳의 반복이 1곳으로 줄고, 신규 provider/필드 추가 시 봉투 형태 누락 위험이 원천 차단된다. 이번 PR 범위(동작 보존)를 벗어나므로 별도 후속 커밋으로 제안.

- **[INFO]** 에러 메시지 절단 길이 `256` 이 매직 넘버로 두 번 하드코딩
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:310`, `:316` (`translateSetupChannelError`)
  - 상세: `message.slice(0, 256)` 이 같은 함수 안에서 두 번 반복된다. 의미(로그/응답에 노출할 외부 에러 메시지 상한)를 나타내는 이름이 없어 "왜 256인가"가 코드만 봐서는 드러나지 않는다. `grep` 으로 백엔드 전체를 확인했을 때 이 파일 두 곳 외에는 이 리터럴을 쓰는 곳이 없어, 프로젝트 공용 상수도 아니다.
  - 제안: 함수 상단에 `const MAX_ERROR_REASON_LENGTH = 256;` 같은 이름을 붙이면 의도가 드러나고 두 자리 값을 동시에 바꿀 수 있다. 순수 이동 범위를 벗어나므로 후속 처리 권장.

- **[INFO]** `chatChannel as unknown as Record<string, unknown>` 캐스팅 패턴이 두 함수에서 반복
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:96`(`assertChatChannelInputSafe`), `:141`(`assertPatchCarriesNoSecrets`)
  - 상세: 두 함수 모두 DTO 타입에 없는 "외부에서 오면 안 되는 필드"의 존재 여부를 검사하기 위해 같은 이중 캐스팅을 반복한다. 기능상 문제는 없으나(둘 다 타입에 없는 필드를 안전하게 조회하려는 동일 의도), 같은 이스케이프 해치가 반복되면 다음 사람이 새 필드를 검사할 때 세 번째 캐스팅을 또 만들 가능성이 있다.
  - 제안: `hasField(obj: ChatChannelInput, key: string): boolean` 같은 좁은 헬퍼로 감싸면 캐스팅이 한 곳으로 모이고 두 호출부는 의도(`hasField(chatChannel, 'botTokenRef')`)만 남는다. 이 또한 이번 PR 범위 밖의 후속 개선으로 제안.

- **[INFO]** `TriggersService` 는 이번 추출 이후에도 여전히 크다(1,585줄)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (전체)
  - 상세: plan 문서(`plan/in-progress/impl-chat-channel-binder.md`)가 스스로 실측한 대로 원래 1,881줄에서 chat-channel 관련 342줄(T1) 중 검증 로직을 제거해 1,585줄이 됐다. 절대적으로는 여전히 큰 서비스 클래스지만, 이 PR 이 T1(순수 함수, 의존 0)만 옮기고 T2(secret 쓰기·ref 보존, 협력자 6개)는 의도적으로 다음 커밋으로 분리한다고 plan 에 명시돼 있어 스코프상 자연스러운 중간 상태다. 새로 만든 문제가 아니라 추적 중인 기존 상태이므로 이 PR 자체에 대한 감점 사유는 아니다.
  - 제안: 없음 — plan 의 T2 단계(다음 커밋)에서 계속 줄어들 것으로 예상되며, 현재는 정보 제공 목적.

## 좋았던 점 (참고)

- 신규 파일의 JSDoc/인라인 주석이 "왜 클래스가 아니라 함수인가", "왜 오버로드로 mode 와 DTO 타입을 묶는가", "`@workflow/chat-channel-validation` 과 왜 다른가" 등 설계 결정의 근거를 코드 옆에 직접 남겨 향후 유지보수자가 같은 실수(예: PATCH 에 생성 전용 검증을 걸어 slack/discord 편집을 깨뜨리는 회귀)를 반복하지 않도록 방어하고 있다.
- `assertChatChannelInputSafe` 의 함수 오버로드(문자열 판별자 `mode` 와 DTO 타입을 컴파일 타임에 결속)는 다소 장황해 보이지만, 그 자체가 이 PR 이 막으려는 보안 결함 클래스(모드-타입 짝 깨짐)를 타입 시스템으로 재발 방지하는 장치로 문서화돼 있어 유지보수성 관점에서 정당한 트레이드오프다.
- 이관이 정확히 "테스트 무편집"을 증거로 요구한 대로, `triggers.service.ts` 안에 제거된 메서드에 대한 `this.*` 잔여 호출이 0건임을 직접 확인했다 — 순수 이동이 실제로 순수했다.

## 요약

이번 PR 은 도메인 검증 로직을 서비스 클래스에서 순수 함수 모듈로 분리하는 리팩터로, 이름·주석·설계 근거 문서화 수준이 이 코드베이스 평균 이상이며 이관 자체도 깨끗하게(잔여 참조 0건) 이뤄졌다. 남은 지적은 전부 이 PR 이전부터 존재하던 반복 패턴(에러 봉투 생성 중복, 매직 넘버 256, 캐스팅 반복)이 한 파일로 모이며 더 눈에 띄게 된 것으로, 동작을 바꾸지 않는 후속 정리로 처리하기에 적합한 낮은 우선순위 항목들이다. `TriggersService` 잔존 크기 역시 plan 이 이미 인지하고 다음 단계로 명시적으로 분리해 둔 사안이다.

## 위험도

LOW
