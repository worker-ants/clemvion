# 보안(Security) 코드 리뷰

커밋: `cbb39dec` — feat(web-chat): presentation 노드 표시 메시지(execution.message) + 미리보기 세션 초기화·2-column 배치

---

## 발견사항

### [INFO] SSE 이벤트 페이로드의 NodeExecution.outputData 노출 범위
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 변경 (~4572 라인)
- **상세**: 신규 `execution.message` 이벤트는 `adapted.config`와 `adapted.output`을 그대로 SSE EIA 표면으로 전송한다. `adapted` 객체는 `adaptHandlerReturn`의 결과물로, 노드 핸들러가 반환한 `{config, output}`을 직접 운반한다. presentation 4종(carousel/table/chart/template)은 표시-전용 노드이므로 정의상 렌더링 데이터만 담아야 하나, 이 계약이 코드 레벨에서 강제되지 않는다. 노드 핸들러 작성자가 실수로 `config` 또는 `output` 안에 내부 API 키·인증 토큰 등 민감 정보를 포함시킬 경우 외부 EIA 표면으로 직접 유출된다.
- **평가**: 기존 스펙(EIA §5.2 R17 Rationale)에서 이미 "노드 핸들러는 outputData에 민감 중간결과를 기록하지 않아야 한다"는 관례가 존재하고, 현재 4종 핸들러는 실제로 표시 데이터만 반환하므로 즉각적인 위험은 낮다. 단, 런타임 allowlist 필터("허용 키 런타임 allowlist 필터는 후속 하드닝 항목"이라고 spec에 명시)가 아직 없어 이 계약이 관례에만 의존한다는 구조적 취약성은 유지된다.
- **제안**: 현 시점 코드 동결 대상(기존 INFO-known 항목과 동일 성격). 후속 하드닝 phase에서 `adapted.config`·`adapted.output`에 대해 노드 타입별 허용 키 allowlist 필터를 `adaptHandlerReturn` 수준에서 적용하거나, SSE 어댑터가 `execution.message` payload에 대해 presentation 렌더 필드만 통과시키는 projection을 추가한다.

---

### [INFO] execution.message seq 필드를 통한 실행 시퀀스 추론 가능성
- **위치**: `spec/5-system/14-external-interaction-api.md` 신규 payload 예시 + `codebase/backend/src/modules/websocket/websocket.service.ts`
- **상세**: `execution.message` 이벤트는 `seq`(monotonic 카운터)와 `timestamp`를 포함한다. 이는 기존 모든 SSE 이벤트와 동일한 패턴이므로 신규 위험은 없다. 다만 presentation 노드가 발행하는 `seq` 값을 통해 외부 클라이언트가 execution 내 노드 실행 순서 및 대략적인 흐름 개수를 추론할 수 있다(예: seq 1→12로 뛰면 중간 노드가 11개 이상 실행됨을 알 수 있음).
- **평가**: 이는 EIA 표면의 설계적 특성(seq는 재연결·replay용)으로, 이번 변경이 새로 도입한 위험이 아니다. 정보 노출 수준은 기존 `execution.ai_message` 등과 동일하다.
- **제안**: 현 상태 유지. 민감 비즈니스 흐름을 보호해야 하는 경우 seq를 실행별 독립 카운터로 유지하는 현재 설계는 적절하다(교차 실행 seq 추론 불가).

---

### [INFO] wc:command "resetSession" origin 검증 — 현 구현 적절, 주의사항 기록
- **위치**: `codebase/frontend/src/components/web-chat/live-preview.tsx` `postCommand` 함수 + `codebase/channel-web-chat/src/widget/use-widget.ts` onCommand 핸들러
- **상세**: `postCommand`는 `widgetOrigin`이 없으면 전송을 건너뛰며(`if (!widgetOrigin) return`), 전송 시 `postMessage(msg, widgetOrigin)` 두 번째 인자로 명시적 origin을 지정한다. 위젯 측 수신(`use-widget.ts`)은 기존 `wc:command` 처리 구조를 재사용하는데, 해당 구조에서 e.origin 검증이 이미 수행되고 있다고 가정된다. 추가로 `live-preview.tsx`의 수신 핸들러(`onMessage`)는 `e.source !== iframeRef.current?.contentWindow`와 `e.origin !== expectedOrigin` 두 조건으로 발신원을 검증하고 있다(iframe→host 방향).
- **평가**: host→iframe 방향 `wc:command` 전송은 명시적 targetOrigin으로 보호되어 있다. iframe→host 방향도 이중 검증(source + origin)이 적용되어 있다. `resetSession` 커맨드 자체는 세션 대화 초기화(`newChat`: closeStream→clearSession→start)만 수행하며, 데이터 누출이나 권한 상승을 유발하지 않는다.
- **제안**: 현 상태 적절. 단, 위젯 측 `use-widget.ts` onCommand 핸들러에서 `e.origin` 검증이 실제로 수행되는지 확인이 필요하다. 코드 diff에서 수신 측의 origin 검증 경로가 직접 노출되지 않았으므로, 기존 구현에서 해당 검증이 없다면 `wc:command` 수신 시 origin 화이트리스트 검증을 추가해야 한다(현재는 INFO 수준).

---

### [INFO] presentations envelope의 XSS 위험 — 렌더링 레이어 위임 구조
- **위치**: `codebase/channel-web-chat/src/lib/eia-events.ts` `parseMessage` + `codebase/channel-web-chat/src/widget/use-widget.ts` dispatch
- **상세**: `parseMessage`는 `ev.presentations`를 검증 없이 pass-through하여 `Array<Record<string, unknown>>` 타입으로 반환한다. 이 데이터는 `dispatch({ type: "AI_MESSAGE", text: "", presentations })`를 통해 위젯 렌더러(`classifyPresentation`, `toTemplate` 등)로 전달된다. XSS 위험은 렌더러가 이 데이터를 어떻게 처리하느냐에 달려 있다. `template` 노드의 경우 `output.rendered`에 마크다운 텍스트가 들어가며, 위젯이 이를 HTML로 렌더링할 때 sanitization 여부가 중요하다.
- **평가**: presentation 데이터의 원본은 워크플로우 노드 출력(서버 측)이므로, 외부 사용자 입력이 직접 주입되는 경로는 아니다. 그러나 워크플로우 설계자가 악의적 HTML/스크립트를 `template.output.rendered`에 포함시키면 위젯이 렌더링 시 XSS가 발생할 수 있다. 이는 이번 변경이 새로 만든 위험이 아니라 기존 `execution.ai_message`의 presentations 렌더링과 동일한 신뢰 모델이다("동일한 위젯 렌더 경로를 탄다"는 설계 결정).
- **제안**: 현 상태 유지(기존 `AI_MESSAGE` 렌더러와 동일 수준). 렌더러 레이어(`toTemplate` 등)에서 HTML 출력 시 DOMPurify 또는 동급 sanitizer가 적용되고 있는지는 별도 렌더러 리뷰 대상이며, 이번 diff 범위 외다.

---

### [INFO] iframe sandbox 속성 — allow-same-origin + allow-scripts 조합 트레이드오프 유지
- **위치**: `codebase/frontend/src/components/web-chat/live-preview.tsx` iframe 엘리먼트
- **상세**: iframe에 `sandbox="allow-scripts allow-same-origin allow-forms"`가 적용되어 있다. 코드 내 주석("allow-scripts 와 함께 두는 트레이드오프는 신뢰된 1st-party 위젯 한정으로 수용")에서 이미 이 결정이 명시적으로 인식되고 기록되어 있다. `allow-same-origin`이 있으면 iframe 내 스크립트가 부모 페이지의 DOM에 접근할 수 있으므로, iframe 콘텐츠가 신뢰된 1st-party 자산임이 전제이다.
- **평가**: 이번 변경이 sandbox 속성을 수정하지 않았으므로 신규 위험은 없다. 기존 설계 트레이드오프 그대로이며, same-origin iframe이 위젯 SPA의 localStorage/세션 동작을 위해 필요한 것임이 명시되어 있다.
- **제안**: 현 상태 유지. 만약 향후 cross-origin iframe(CDN 분리 배포)으로 전환되면 sandbox 재검토가 필요하다.

---

## 요약

이번 커밋(`cbb39dec`)은 보안 관점에서 전반적으로 안전하게 구현되었다. 핵심 우려 대상인 `execution.message` SSE 이벤트의 EIA 표면 노출은 `PRESENTATION_NODE_TYPES` 화이트리스트로 발행 범위를 presentation 4종으로 한정하고 있으며, node-level firehose(`execution.node.completed`) 직접 노출을 의도적으로 차단한 설계 결정이 오히려 보안 경계를 개선했다. `wc:command resetSession` origin 검증은 명시적 targetOrigin 지정으로 적절히 보호되고 있다. `presentations` envelope의 pass-through 처리는 기존 `AI_MESSAGE` 렌더 경로와 동일한 신뢰 모델을 따르며, XSS 위험은 렌더러 레이어에서 이미 관리(또는 관리해야 할)되어 있다. 하드코딩된 시크릿·인젝션 취약점·인증 우회·암호화 문제·에러 메시지 민감정보 노출은 발견되지 않았다. 발견된 모든 항목은 INFO 수준으로, 기존 설계의 인식된 트레이드오프이거나 이번 변경이 새로 만든 위험이 아닌 기존 패턴의 연장이다.

---

## 위험도

LOW

STATUS: DONE
