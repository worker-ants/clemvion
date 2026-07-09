# API 계약(API Contract) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원 changeset — 5번째(최종 수렴) 리뷰 라운드. 이번 payload(26개 파일)는 실질적으로 (1) 3라운드
> `/ai-review`(19_26_15) 산출물 5개 + (2) 4라운드 `/ai-review`(19_40_53) 산출물 10개(RESOLUTION/SUMMARY 포함) +
> (3) `consistency-check --spec`(18_27_06) 산출물 5개 + (4) spec 본문 4개 파일(`14-external-interaction-api.md`,
> `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`)로 구성된다. **애플리케이션 코드
> (`interaction.service.ts`/`use-widget.ts`/`panel.tsx`/`conversation.ts` 등) 자체의 diff 는 이번 payload 에
> 포함돼 있지 않다** — 4라운드 RESOLUTION.md 가 반영했다고 기록한 WARNING #1(concurrency, `start()` catch gen
> 검사 누락)·WARNING #2(documentation, `"gone"` reason 미발사)의 실제 fix 커밋 diff 는 이미 별도 커밋으로
> 반영된 뒤 이번 changeset 라우팅에서 제외된 것으로 보인다(알려진 "리뷰 changeset 이 직전 검토 코드 제외" 패턴).
> 아래는 이 payload 에 담긴 spec diff(4개 파일)와 인용된 코드 근거만으로 API 계약 관점을 독립 재검증한 결과다.

## 발견사항

- **[INFO]** `context.conversationThread` — "키 생략 vs null" 관례가 형제 필드와 다르고 전용 DTO 로 스키마화되어 있지 않음 (4라운드 재확인, 미해소·backlog)
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3/§R17(`context.conversationThread` durable snapshot 절)
  - 상세: `waiting_for_input` + durable thread 존재 시에만 `context.conversationThread` **키 자체가 존재**하고,
    없으면 키가 생략된다 — 같은 `context` 객체의 형제 필드(`interactionType`/`waitingNodeId`/`buttonConfig`/
    `nodeOutput`)는 해당 없음일 때 `null` 값을 채우는 관례와 다르다. `ExecutionStatusDto.context` 타입이
    `Record<string, unknown> | null` 로 개방형이라 Swagger 시그니처 자체는 깨지지 않지만, 역으로
    `conversationThread` 필드의 존재/타입이 OpenAPI 스키마 레벨에서 형식적으로 문서화되지 않는다는 뜻이다.
    이 설계는 SSE `waiting_for_input` wire 형식과의 의도적 parity 이며 하위 호환성 자체엔 영향 없다.
    4라운드 RESOLUTION(`review/code/2026/07/09/19_40_53/RESOLUTION.md`)에서 "spec 명문화됨, 저우선"으로 defer
    확정된 항목으로, 이번 라운드에 신규로 악화되거나 해소된 변화는 없다.
  - 제안: 조치 필수 아님(기존 backlog 유지). 여력이 되면 `context` 전용 DTO 클래스 도입으로 Swagger 상
    `conversationThread` 존재/타입을 명시하면 제3자 API 소비자의 옵셔널/nullable 오판을 줄일 수 있다.

- **[INFO]** durable thread 존재 + 대기 `NodeExecution` 부재 조합 시 `context` 전체가 `null` 로 떨어져 `conversationThread` 가 조용히 드롭 — spec 본문 미명문화·테스트 미고정 (4라운드 재확인, 미해소·backlog)
  - 위치: 코드 근거(인용) `codebase/backend/src/modules/external-interaction/interaction.service.ts:260-296` —
    `conversationThread` 는 `WAITING_FOR_INPUT` 블록 최상단에서 계산되나 `context` 조립 자체는 중첩된
    `if (nodeExec?.node)` 안에서만 발생.
  - 상세: spec §R17 은 "`waiting_for_input` 상태면 durable thread 를 동봉한다"고 서술하지만, 구현은 암묵적으로
    "대기 `NodeExecution` 이 실제 존재+`node` relation 로드됨"이라는 선결 조건을 하나 더 둔다. 실행 엔진
    불변식상 도달 가능성이 낮은 데이터 정합성 극단 케이스라 CRITICAL 급 계약 위반은 아니지만, 응답 형식의
    스펙-구현 완전 일치 관점에서는 미세한 갭이며 회귀 테스트로도 고정돼 있지 않다(`testing.md` INFO 로도 3라운드
    연속 재확인·defer).
  - 제안: 우선순위 낮음. 여력이 되면 spec §5.3/§R17 에 "대기 NodeExecution 자체가 유실된 극단 케이스에서는
    `context` 전체가 `null` 로 fail-safe 한다"는 한 줄을 추가하고, `nodeRepo.findOne` null + durable thread 존재
    조합의 회귀 테스트 1건을 추가하면 충분하다.

- **[INFO]** `conversationThread.turns[]` — `waiting_for_input` 무기한 보존 불변식과 결합 시 단일 REST 응답 payload 크기 상한 정책 부재 (4라운드 재확인, 스코프 밖으로 명시적 defer)
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화 (restart)" 행 — "이전 execution 은 명시 종료
    명령을 보내지 않으므로 서버에선 `waiting_for_input` 로 잔존"(무기한 보존, GC 없음)과 `14-external-interaction-api.md`
    §R17 의 durable thread 전체 동봉 결합.
  - 상세: 사용자가 "새 대화"를 반복 사용하면 서버측 `waiting_for_input` Execution row 가 종료 명령 없이 계속
    쌓이고(orphan 축적, spec 이 이미 트레이드오프로 명문화·backlog 추적 중), 만에 하나 매우 긴 단일 대화가
    누적되면 `getStatus` 가 그 `conversationThread.turns[]` 전체를 단일 응답으로 반환하게 될 잠재적 여지가
    있다. 3라운드에 걸친 코드 리뷰·consistency-check 어디에서도 이를 blocking 이슈로 보지 않았고, truncation/
    상한 정책은 현재 스코프 밖으로 명시적으로 defer 되어 있다.
  - 제안: 조치 불필요(이번 PR 범위 밖). 장기 실행 대화가 실제 운영에서 누적되면 응답 크기 상한/truncation
    정책을 별도 plan 으로 검토할 가치가 있다는 점만 참고로 남긴다.

- **[INFO]** `wc:event conversationEnded.data.reason` 열린 문자열 확장 — 4라운드에서 spec-code 불일치(WARNING)로 지적됐으나 RESOLUTION 상 코드 수정으로 해소 기록됨(fix 커밋 diff 자체는 이번 payload 밖이라 직접 재확인 불가)
  - 위치: `spec/7-channel-web-chat/2-sdk.md`(`wc:event` 행, `conversationEnded.data.reason` ∈ SSE terminal
    이벤트명 / `user_ended` / `gone`), `review/code/2026/07/09/19_40_53/RESOLUTION.md` WARNING #2.
  - 상세: 4라운드 documentation 리뷰가 "`gone` reason 예시가 실제로는 `sendCommand` 410 catch 에서 `sendEvent`
    호출 없이 버려져 host 로 전달되지 않는다"는 spec-code 불일치를 WARNING 으로 지적했고, 같은 라운드
    RESOLUTION.md 는 "sendCommand 410 catch 에 `sendEvent(\"conversationEnded\", {reason:\"gone\"})` 추가 —
    모든 종료 경로가 host 통지 일관, 회귀 테스트: submit_message 410 → phase ended"로 반영을 기록했다. 이
    fix 의 실제 `use-widget.ts` diff 는 이번 payload 범위 밖이라 API 계약 관점에서 직접 재검증은 불가능했으나,
    RESOLUTION 기록이 사실이라면 host SDK 이벤트 계약(`wc:event conversationEnded.reason`)이 spec 이 약속한
    3개 사유(SSE terminal 이벤트명/`user_ended`/`gone`) 전부를 실제로 발사하게 되어 API 계약 완전성이
    개선된 상태다. `2-sdk.md` 의 "열린 문자열, 강결합 금지" 서술 자체는 forward-compatible 하게 잘 설계돼
    있어 이 확장이 host 통합에 breaking 을 일으키지 않는다.
  - 제안: 조치 불필요(정상 반영 경로로 판단). 다음 라운드에서 `use-widget.ts` 실제 diff 가 changeset 에 포함되면
    `sendCommand` 410 catch 의 `sendEvent` 호출을 코드 레벨로 1회 재확인하는 것을 권장.

## API 계약 관점 체크리스트 확인

1. **하위 호환성**: 이번 changeset 이 실제로 도입한 변경(`context.conversationThread` additive optional 필드,
   `conversationEnded.reason` 값 확장)은 모두 기존 클라이언트를 깨뜨리지 않는 순수 확장이다. 신규 엔드포인트·
   기존 필드 제거/타입 변경 없음 — breaking change 없음.
2. **버전 관리**: 별도 버전 스킴 없이 spec `## Rationale`(R17 addendum, 기각 대안 포함)로 변경 이력을 남기는
   기존 컨벤션을 유지. additive 확장은 무버저닝 상태에서도 안전.
3. **응답 형식**: SSE `waiting_for_input` wire 형식과 parity 를 맞춘 일관된 설계이나, 위 INFO #1/#2 두 갭
   (키 생략 vs null 비대칭, node-null edge case)이 낮은 우선순위로 여전히 open 상태다.
4. **에러 응답**: 이번 changeset 으로 신규 에러 시나리오·상태 코드는 추가되지 않았다. 기존 `410 Gone`
   (EIA-IN-12)·`404 EXECUTION_NOT_FOUND`·`401`(낙관적 refresh 1회) 처리는 무변경.
5. **요청 검증**: `GET /api/external/executions/:id` 는 read-only 조회로 신규 요청 파라미터/바디 없음 — 해당 없음.
6. **URL/경로 설계**: 신규 엔드포인트·경로 변경 없음. 기존 RESTful 리소스 경로 그대로 재사용.
7. **페이지네이션**: 목록 API 변경 없음. `conversationThread.turns[]` 크기 상한 미정책화(INFO #3, 스코프 밖 defer).
8. **인증/인가**: `InteractionGuard`(`iext_*`/`itk_*` 토큰 ↔ URL `:executionId` 바인딩) 무변경. 신규 노출
   `conversationThread` 도 이미 동일 execution 에 대해 SSE 로 공개되던 것과 동일 wire shape 라 인가 경계 밖
   데이터 노출(IDOR) 없음.

## 요약

이번 라운드(20_01_04)는 실질 애플리케이션 코드 diff를 포함하지 않고, 앞선 4라운드 리뷰 산출물의 커밋과 이미
분석 완료된 spec 본문(EIA §R17, widget-app §2/§3.1, sdk §3, auth-session §3.1) 재노출로 구성돼 있다. 4라운드
api_contract 리뷰(LOW, INFO 3건)가 지적한 항목들 — (1) `conversationThread` 키 생략 vs 형제 필드 null 관례
비대칭·OpenAPI 미문서화, (2) 대기 NodeExecution 부재 시 `context` 조용한 null 드롭(테스트 미고정), (3)
`conversationThread.turns[]` payload 크기 상한 미정책화 — 은 RESOLUTION.md 상 모두 "저우선/backlog"로 defer
확정된 상태 그대로이며, 이번 라운드에서 신규로 악화되거나 새로 발견된 CRITICAL/WARNING 급 API 계약 위반은
없다. 4라운드 WARNING #2(`conversationEnded.reason "gone"` spec-code 불일치)는 RESOLUTION 기록상 코드 수정으로
해소됐다고 보고되었으나 그 fix 자체의 diff 는 이번 payload 범위 밖이라 직접 재검증하지 못했다(다음 라운드에서
코드 diff 가 포함되면 재확인 권장). 신규 엔드포인트·경로·요청 파라미터·에러 코드·인증 메커니즘 변경은 없으며,
모든 변경은 하위 호환 additive 확장에 해당한다.

## 위험도
LOW
