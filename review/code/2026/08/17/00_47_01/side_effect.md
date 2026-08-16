# 부작용(Side Effect) 리뷰

## 검토 방법

`origin/main` 대비 이 브랜치(6 커밋: `a8b0cbfdd`·`1b8fd5cc7`·`fe6a54c80`·`e5a63abff`·`b05756d9e`·`81c9fcd60`)의
누적 diff를 대상으로 했다. 이 changeset은 이미 세 차례(`23_08_19`·`23_50_03`·`00_23_57`) side_effect
리뷰를 거쳤고 매 라운드 위험도 LOW로 수렴했다. 이번 라운드의 신규 델타는 마지막 커밋(`81c9fcd60`,
`docs(spec)`)뿐이며, 코드 파일 변경은 `executions.service.spec.ts`의 JSDoc 주석 1건(표면 개수
"넷"→"다섯" 정정)이 전부다 — 런타임 동작 변경이 없다. 따라서 본 라운드는 (1) 이 델타에 새 부작용이
없는지, (2) 선행 세 라운드가 INFO로 남기고 "조치 불요"로 처분한 항목들이 최신 소스와 여전히 일치하는지를
`codebase/backend/src/modules/executions/executions.service.ts`·
`codebase/backend/src/modules/websocket/websocket.service.ts`·
`codebase/backend/src/shared/utils/sanitize-error-message.ts`·
`codebase/backend/src/shared/utils/redact-stored-error.ts`
전문을 직접 열어 재확인하는 데 집중했다.

## 발견사항

- **[INFO]** (선행 라운드에서 이미 확인·반복, 최신 소스로 재검증 완료) 공유 유틸 `deepRedactSecrets`의
  "이미 마스킹된 마커는 재마스킹하지 않는다" 규칙 변경이 이 diff에 없는 다른 소비자에도 전역 적용된다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:118`(`VALUE_MASK_MARKER`),
    `:120`(`KEY_MASK_MARKER`), `:122`(`DEPTH_MASK_MARKER`), `:124`(`MASKED_MARKERS`),
    `:178`(`deepRedactSecrets`), `:204`(`deepRedactSecretsPreserving`)
  - 상세: `deepRedactSecrets`는 이번 PR 대상 호출부(`redact-stored-error.ts`) 외에도 `terminal-error-payload.ts` 등
    diff 밖 모듈에서 호출된다. 마커 보존 방향은 한쪽(마스킹 완화 아님)으로만 열려 있어 신규 유출을 만들지
    않는다는 이전 판정이 최신 소스에서도 그대로 유지된다. 캐너리(`sanitize-error-message.spec.ts` "기존
    마스킹 마커 보존")로 계약이 고정돼 있다.
  - 제안: 조치 불요. 기록만 유지.

- **[INFO]** (선행 라운드에서 이미 확인·재검증) WS 내부(에디터) wire 채널의 emit payload가 `maskWireEnvelope`를
  거쳐 값-마스킹된다 — 프로토콜 동작 변경.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387`(`maskWireEnvelope` 정의),
    `:261`·`:335`(호출부, `emitExecutionEvent`/`emitNodeEvent`), `:408`(`toFanoutEnvelope`)
  - 상세: `execution:<id>` 채널을 구독하는 모든 내부 클라이언트가 받는 실제 바이트가 바뀐다. `llmCalls`만
    `WIRE_PRESERVED_FIELDS`(`:79`)로 예외 처리된다. CHANGELOG·EIA §R17·유저 가이드에 명시적으로 공지됐고
    회귀 테스트로 고정돼 있어 통지되지 않은 부작용은 아니다. 이번 라운드에서 추가된 마지막 커밋
    (`15-chat-channel.md` CCH-MP-06 verbatim 계약 캐비엇 반영)도 같은 결정의 문서 정합화일 뿐 코드 동작은
    바꾸지 않는다.
  - 제안: 조치 불요.

- **[INFO]** (선행 라운드에서 이미 확인·재검증) `ResponseExecution`/`ResponseNodeExecution` export 타입이
  `outputData`를 `Record<string, unknown>` → `Record<string, unknown> | null`로 넓힌 인터페이스 변경.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:147`(`ResponseExecution`),
    `:162`(`ResponseNodeExecution`)
  - 상세: 이 타입을 import하는 diff 밖 소스 모듈이 있는지 재확인했으나 `dist/`(재생성 산출물) 외 실제
    소비자는 여전히 0건이다. `nest build`가 이전 라운드에 이 확장으로 인한 타입 오류를 실제로 잡아낸 바
    있어(`maskIfPresent` 제네릭 이슈 포함, `:83`-`:132` JSDoc 참조) 회귀 위험은 낮다.
  - 제안: 조치 불요.

- **[INFO]** (선행 라운드에서 이미 확인·재검증) `ExecutionsService.stop()`이 마스킹 전 엔티티 대신
  `toResponseExecution` 관문을 통과한 복사본을 반환하는 계약(이 브랜치 이전 커밋 `#1179`에서 이미
  도입되어 이번 diff의 변경분은 아님)이 그대로 유지된다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:900`(`stop`), `:1087`(`toResponseExecution`)
  - 상세: 내부 호출부(`interaction.service.ts`, `hooks.service.ts`)가 `stop()`의 반환값을 캡처하지 않는다는
    이전 라운드의 grep 결과가 최신 소스에서도 유효하다.
  - 제안: 조치 불요.

## 부작용 없음 확인 (양호한 지점, 재확인)

- `redactStoredDataForResponse`(`redact-stored-error.ts:66`)와 `maskIfPresent`(`executions.service.ts:111`)
  모두 copy-on-change를 지켜 입력을 in-place mutate하지 않는다 — DB 엔티티나 호출자 인자가 오염될 경로가
  없다.
- `deepRedactSecrets`의 depth-0 `WeakMap` 캐시(`sanitize-error-message.ts:158`)와 `deepRedactSecretsPreserving`
  (캐시 미사용, `:204`)이 여전히 분리돼 있고, 캐시 키가 객체 identity라 `error`/`inputData`/`outputData`
  세 컬럼(서로 다른 객체 참조)이 교차 오염될 경로가 없다 — `sanitize-error-message.spec.ts` "캐시를
  공유하지 않는다" 캐너리로 고정.
- `WIRE_PRESERVED_FIELDS`(`websocket.service.ts:79`)는 `EXTERNAL_STRIPPED_FIELDS` 배열을 복사해 새
  `ReadonlySet`을 만들므로 원본 배열을 통한 외부 뮤테이션 경로가 없다.
- 이번 라운드의 유일한 실질 델타(`81c9fcd60`)는 JSDoc 주석 1건 + `spec/`·`plan/`·`review/` 문서 변경뿐이며,
  프로덕션 코드 경로·전역 상태·파일시스템(애플리케이션 런타임)·환경 변수·네트워크 호출·이벤트/콜백 어디에도
  새 변경이 없다. `review/code/**`·`review/consistency/**` 하위 산출물 신규 생성은 developer/review 워크플로가
  상시 승인한 쓰기 권한 범위 내 정규 파일시스템 부작용이라 별도 지적 대상이 아니다.

## 요약

이번 라운드가 검토한 실질 델타는 문서 정합화 커밋(`81c9fcd60`) 하나뿐이며 런타임 코드 변경이 없어 신규
부작용은 발견되지 않았다. 앞선 세 라운드가 이미 짚어 수용한 세 항목(공유 유틸 `deepRedactSecrets`의
전역 마커-보존 규칙 확장, WS 내부 wire payload 바이트 변경, `ResponseExecution`/`ResponseNodeExecution`
타입 확장)은 이번 라운드에서 소스를 직접 재확인한 결과 판정이 그대로 유효하다 — 전부 문서화되고
회귀 테스트로 고정된 의도된 변경이며, 예상 밖 전역 상태 변경·파일시스템 부작용·환경 변수 접근·네트워크
호출·이벤트 계약 파손은 관찰되지 않았다.

## 위험도

LOW
