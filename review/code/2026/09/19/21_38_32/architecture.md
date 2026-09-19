# 아키텍처 리뷰 — SMTP SSRF 가드를 `http-safety` 로 통합

## 발견사항

- **[WARNING]** 공용 SSRF 판정 로직이 특정 기능(HTTP Request) 폴더 안에 계속 상주하며, 이번 변경이 그 폴더에 대한 형제 노드의 의존을 하나 더 늘렸다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:1` (`import { assertSafeOutboundHostResolved } from '../http-request/http-safety.js';`), `codebase/backend/src/nodes/integration/http-request/http-safety.ts:1`~`5` (모듈 docstring이 "SSRF guard helpers for the integration nodes — HTTP Request … DB Query, Send Email" 로 갱신됨)
  - 상세: `http-safety.ts` 는 이제 스스로도 "HTTP Request / DB Query / Send Email 3개 노드의 공용 SoT" 라고 문서화한다. 그런데 물리적 위치는 `nodes/integration/http-request/` 라는 **특정 기능 폴더** 안이다. `database-query.handler.ts` 가 이미 그 경로를 가져다 쓰고 있었고(이번 변경 이전부터 존재하는 패턴), 이번 PR은 `send-email/smtp-host-guard.ts` 를 추가해 같은 폴더에 대한 형제 의존을 하나 더 만들었다. 즉 "진짜 공용 유틸"이 한 소비자의 소유 폴더 밑에 숨어 있고, 나머지 소비자들이 그 폴더 내부 구현에 직접 손을 뻗는 구조다. 순환 참조는 없음을 확인했다(`http-request/` 쪽에는 `send-email`/`database-query` 로의 역참조가 없다) — 다만 결합 방향이 "형제 폴더 → 형제 폴더의 구현 파일"이라 모듈 경계가 흐리다.
  - 제안: 크리티컬은 아니지만, 다음 정리 시점에 `http-safety.ts` 를 `nodes/integration/common/` 같은 중립 위치로 옮기는 편이 "3개 노드 공용 SoT" 라는 문서화된 의도와 폴더 구조를 일치시킨다. 지금 구조를 유지한다면 최소한 이번 PR의 plan 문서에 이미 있는 것처럼(“nodes 역방향 import를 피하려고 옮겼다”) 이 폴더-소유권 트레이드오프를 spec/convention 문서에도 한 줄 남겨두는 편이 다음 사람의 재발견 비용을 줄인다.

- **[WARNING]** 예외 메시지 문자열 접두어 매칭으로 두 모듈 간 "판정 결과" 를 전달한다 — 타입으로 보장되지 않는 계약.
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:25` (`if (err instanceof Error && err.message.startsWith('SSRF_BLOCKED')) { return true; }`)
  - 상세: `assertSafeOutboundHostResolved`(`http-safety.ts`)는 판정 실패를 오직 `Error` 인스턴스의 **메시지 문자열이 `'SSRF_BLOCKED'` 로 시작하는지**로만 구분 가능하게 던진다(별도 에러 클래스 없음). `isSmtpHostBlocked` 는 그 문자열 접두어를 파싱해 boolean 으로 되돌린다. 이는 두 모듈 사이의 계약이 타입이 아니라 "메시지 문자열의 접두어" 라는 암묵적 규약에 의존한다는 뜻이다 — `http-safety.ts` 쪽에서 메시지 포맷을 리팩터링(예: 다국어화, 래핑, 접두어 변경)하면 컴파일러는 아무것도 잡아주지 못하고, `isSmtpHostBlocked` 는 정상 SSRF 차단을 "판정 아닌 오류"로 오인해 그대로 `throw` 하게 된다(반대로 원래 무해했던 에러가 우연히 저 접두어로 시작하면 "차단됨"으로 오판할 수도 있다). 현재 스펙 안에서는 던지는 지점이 4곳뿐이고 전부 `SSRF_BLOCKED:` 로 시작해 지금은 일관되지만, 계약 자체가 문자열에 의존한다는 점이 취약하다.
  - 제안: `http-safety.ts` 에 전용 에러 클래스(예: `class SsrfBlockedError extends Error`)를 export 하고 `instanceof` 로 판별하거나, 애초에 boolean 을 돌려주는 predicate(`isHostBlockedAsync`)를 `http-safety.ts` 자체에서 export해 `isSmtpHostBlocked` 가 예외를 파싱하지 않도록 하는 편이 더 안전한 경계다.

- **[INFO]** 서비스 레이어(`modules/integrations`)가 노드 실행 레이어(`nodes/integration/send-email`)의 파일을 직접 import — 다만 기존 관행의 연장선.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:13` (`import { isSmtpHostBlocked } from '../../nodes/integration/send-email/smtp-host-guard';`)
  - 상세: 이전에는 `smtp-host-guard.ts` 가 `common/utils/` 에 있어 `modules/`(서비스)와 `nodes/`(실행 노드) 양쪽이 중립적인 공용 유틸을 참조하는 구조였다. 이번에 그 파일이 `nodes/integration/send-email/` 로 옮겨지면서, `IntegrationsService`(서비스 레이어)가 특정 노드의 소유 폴더 내부 구현 파일을 직접 가져오는 모양이 됐다. 다만 같은 파일이 이미 `nodes/integration/cafe24/metadata` · `nodes/integration/makeshop/metadata` 를 같은 방식으로 import 하고 있어(이 PR 이전부터), 이 방향의 결합은 이 코드베이스에서 이미 용인된 관행이다 — 이번 변경이 새로 만든 위반은 아니다.
  - 제안: 차단 사유 아님. 다만 "공용 SSRF 판정" 처럼 여러 레이어가 공유하는 로직은 향후 `common/utils/` 로 되돌리거나 신설 중립 위치로 옮기는 편이 이 방향의 결합을 줄인다(위 첫 번째 발견사항과 같은 근본 원인).

- **[INFO]** (긍정적 관찰) 중복 구현 제거로 개방-폐쇄/DRY 이 개선됨.
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` 전체, `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 의 `canonicalIPv6`/`mappedIPv4`/`isBlockedIPv6`
  - 상세: 종전에는 SMTP(`ssrf.util` 기반)와 HTTP/DB(`http-safety` 기반)가 서로 다른 두 개의 SSRF 판정 구현을 갖고 있어 대역표가 어긋났다(CGNAT · `::` 비대칭). 이번 변경은 SMTP 가드를 얇은 어댑터(`isSmtpHostBlocked`)로 남기고 실제 판정 로직은 `http-safety.ts` 하나로 위임해, 향후 대역 추가/수정이 한 곳만 바뀌면 되는 구조로 정리했다. `canonicalIPv6`/`mappedIPv4` 는 모듈-비공개 함수로 적절히 캡슐화되어 있고 각각 단일 책임을 진다. IPv4-mapped 판정 로직 추가도 기존 `isBlockedIPv6` 흐름에 자연스럽게 끼워 넣어 개방-폐쇄 원칙을 크게 해치지 않았다.
  - 제안: 없음 — 유지.

- **[INFO]** 삭제된 구 파일(`common/utils/smtp-host-guard.ts`, `.spec.ts`)에 잔존 참조나 데드 코드가 없는지 확인함 — 깨끗하게 제거됨.
  - 위치: `codebase/backend/src/common/utils/smtp-host-guard.ts` (삭제), `codebase/backend/src/common/utils/smtp-host-guard.spec.ts` (삭제)
  - 상세: `grep` 으로 재확인한 결과 `common/utils/smtp-host-guard` 를 가리키는 잔존 import 는 없다. `integrations.service.ts` · `integrations.service.spec.ts` · `send-email.handler.ts` · `send-email.handler.spec.ts` 전부 새 경로로 일괄 갱신됐다.
  - 제안: 없음.

## 요약

이번 변경은 SMTP · HTTP Request · DB Query 세 노드가 서로 다른 SSRF 판정 구현(및 서로 다른 대역 커버리지)을 갖던 상태를 하나의 SoT(`http-safety.ts`)로 통합한 리팩터링이다. 중복 로직 제거와 개방-폐쇄 원칙 준수라는 관점에서는 개선이지만, 그 SoT 가 여전히 "HTTP Request" 라는 특정 기능의 폴더 밑에 상주하면서 형제 노드(`database-query`, 이번엔 `send-email`)와 서비스 레이어(`modules/integrations`)가 그 내부 구현 파일에 직접 의존하는 모양이 됐고, 판정 실패를 boolean 으로 변환하는 경계가 타입이 아닌 예외 메시지 문자열 접두어에 의존한다는 두 가지 결합도 관련 이슈가 있다. 둘 다 이번 PR이 새로 만든 치명적 위반이라기보다는 기존에 있던(또는 불가피하게 재생산한) 경계 흐림을 그대로 이어받은 것이며, 기능적 정합성이나 순환 의존 문제는 없다.

## 위험도
LOW
