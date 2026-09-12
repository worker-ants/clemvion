# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `ERROR_KO` 가 서로 다른 layer/subsystem 의 에러 코드를 하나의 flat record 에 주석만으로 구분해 담고 있다 — 이번 버그의 근본 구조 원인
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:602-614` (특히 `TRIGGER_NOT_FOUND` 선언부, 게이트 612)
  - 상세: `ERROR_KO` 하나의 `Record<string, string>` 안에 "chat-channel API 에러 코드"·"webhook 인입 경로 코드"·(추후) "일반 API 코드" 가 섞여 있고, 그 경계는 오직 산문 주석(`// chat-channel API 에러 코드 (spec §5.4)`)으로만 표시된다. 이번 diff 가 고치는 결함 자체가 그 구조적 약점의 증거다 — `TRIGGER_NOT_FOUND` 가 실제로는 `hooks.service.ts` 인입 webhook 경로 코드인데, chat-channel 주석 블록 **안에** 물리적으로 위치해 있었을 뿐인 이유로 4개월간 잘못 귀속됐고, 같은 파일의 형제 테스트(`backend-labels.test.ts`)조차 한 블록은 맞게, 다른 블록은 틀리게 적어 서로 반증하는 상태였다. 구조(타입/네임스페이스)가 아니라 위치와 주석에 의존한 경계는 재발 가능성이 높다.
  - 제안: 지금 당장 구조를 바꿀 필요는 없으나(이번 diff 는 주석 귀속만 정정해 올바르게 처리했다), 후속으로 `ERROR_KO` 를 origin 별로 네임스페이스(`{ hooks: {...}, chatChannel: {...}, generic: {...} }`) 하거나 각 키에 origin 메타데이터를 부여하면 같은 클래스의 오귀속이 컴파일/구조 수준에서 방지된다. plan 트래커에 이미 유사 후속 항목(§5-4 스코프 등)이 있으므로 이 항목도 등재만 해 두는 것을 권장.

- **[INFO]** `scanUuidParams` 의 `ParseUUIDPipe` 축 판정이 텍스트 부분일치라 심볼 해석을 우회할 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:164` (`if (!pipes.includes('ParseUUIDPipe')) missing.push('ParseUUIDPipe');`)
  - 상세: `import { ParseUUIDPipe as UuidPipe } from '@nestjs/common'` 처럼 별칭 import 되면 문자열 `'ParseUUIDPipe'` 가 소스에 나타나지 않아 오탐(거짓 위반)이 뜨고, 반대로 이름에 우연히 그 문자열을 포함한 다른 심볼이면 미탐(거짓 통과)이 된다. 심볼 해석을 하려면 타입 체커가 있는 프로그램을 띄워야 해 이 정적 스캐너의 설계 범위를 벗어난다는 점을 주석이 이미 정확히 인지하고 있고, 저장소 실측상 별칭 0건이라 현재는 안전하다.
  - 제안: 현재는 문제 없음 — 다만 나중에 이 가드가 잡아야 할 자리를 별칭 때문에 놓쳤다면 이 텍스트 매칭이 원인일 수 있다는 점을 인지해 둘 것. 코드 변경 불필요.

- **[INFO]** `translateBackendError`/`ERROR_KO` 배선 자체가 프로덕션에서 아무도 소비하지 않는 죽은 계층이라는 점을 이번 배치가 정확히 실측했고, 범위를 넓히지 않은 판단은 적절하다
  - 위치: `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §B 처분(§`ERROR_KO` 를 아무도 읽지 않는다), 관련 코드는 `codebase/frontend/src/lib/i18n/backend-labels.ts` (`ERROR_KO`, `translateBackendError`)
  - 상세: `ERROR_KO` 에 7~8종의 chat-channel 에러 코드가 매핑돼 있지만 이를 읽는 유일한 함수 `translateBackendError` 의 프로덕션 호출부가 0건이고, 실제 화면(`chat-channel-card.tsx`)은 에러 코드를 버리고 고정 문자열을 표시한다. 즉 이 번역 계층은 정의부와 자기 테스트만 있는 "vestigial abstraction" 이다. 이번 diff 는 이를 고치지 않고 문서(`triggers.mdx`)의 "모두 한국어로 표시돼요" 라는 문장만 실제 동작에 맞게 좁혔는데, 이는 스코프 크립을 피하면서 문서-구현 간극을 없앤 올바른 판단이다.
  - 제안: 없음(참고용 기록). 배선 여부(에러 코드를 UI 에 노출할지)는 별도 결정 사안으로 이미 트래커에 등재돼 있다.

## 요약

이번 변경은 `rotateBotToken` 엔드포인트의 UUID 경로 파라미터 계약 결함(파이프 부재로 인한 500 마스킹)을 형제 엔드포인트와 동일한 패턴(`@Param('id', ParseUUIDPipe)` + `@ApiParam({format:'uuid'})`)으로 맞추고, 이를 AST 기반 정적 가드(`param-uuid-pipe-guard.ts`)로 항구화한 작업이다. 가드 로직·테스트 배선·대조군 fixture 가 명확히 분리돼 있고(단일 책임), fixture 를 스캔 루트 밖에 두어 자기 탐지를 피하면서도 다른 전수 스캔 가드에 미치는 부수효과를 주석으로 정직하게 밝히는 등 모듈 경계 관리가 꼼꼼하다. 예외 처리도 이름 허용목록이 아니라 `@ApiExcludeEndpoint()` 구조로 두어 개방-폐쇄 원칙을 지켰고, 컨트롤러 반환 타입을 `Awaited<ReturnType<...>>` 대신 명시적 DTO 로 선언해 서비스 구현 세부사항과 컨트롤러 공개 계약을 디커플링한 점도 의존성 역전 관점에서 긍정적이다. `TRIGGER_NOT_FOUND` 오귀속 정정과 문서 동기화는 부수적으로 `ERROR_KO` flat record 의 구조적 취약점(경계가 주석에만 의존)을 드러냈지만, 이는 이번 diff 가 만든 문제가 아니라 기존 구조의 한계이며 정정 자체는 정확하다. 순환 의존성이나 레이어 침범, 새로운 안티패턴은 발견되지 않았다.

## 위험도
LOW
