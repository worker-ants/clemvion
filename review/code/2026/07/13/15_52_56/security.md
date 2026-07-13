# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 엣지 호버 미리보기가 노드 실행 결과(잠재적 민감 데이터)를 저마찰(hover)로 노출
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`useEdgeFlowData`, `EdgeDataPreviewTooltip`, `EdgeDataModal`)
  - 상세: 툴팁/모달은 `useExecutionStore` 의 `nodeResults`(이미 클라이언트에 로드된, 인증된 워크스페이스 사용자만 볼 수 있는 실행 결과)를 그대로 축약·전체 표시한다. 노드 출력에 자격증명·PII·내부 응답 헤더 등이 그대로 흘러드는 워크플로(예: HTTP Request 노드가 Authorization 헤더를 echo 하는 응답, 통합 노드가 반환하는 토큰)라면, 종전에는 "Run Results" 패널을 열어야 봤을 데이터가 이제 엣지에 마우스만 올려도(그리고 200ms 후에도 유지되는 툴팁으로) 노출된다. 이는 권한 상승이나 신규 데이터 접근 경로는 아니다(동일 세션·동일 워크스페이스 권한 범위 내 데이터, 이미 스토어에 존재) — 다만 화면 공유·데모·어깨너머 관찰(shoulder-surfing) 시나리오에서 우발적 노출 가능성을 높인다.
  - 제안: 별도 강제 조치 불필요(기존 Run Results 와 동일 노출 범위). 다만 향후 노드 출력에 시크릿 마스킹/redaction 정책이 도입된다면 이 미리보기 경로도 함께 적용 대상에 포함해야 한다.

- **[INFO]** 렌더링은 React 텍스트 노드로만 처리되어 XSS 위험 없음(확인 사항, 결함 아님)
  - 위치: `edge-data-preview.tsx` `EdgeDataPreviewTooltip`/`EdgeDataModal` 의 `<pre>{summary.preview}</pre>`, `<pre>{JSON.stringify(data, null, 2)}</pre>`
  - 상세: `dangerouslySetInnerHTML`, `innerHTML` 대입, `eval`, 문자열 기반 동적 스크립트 삽입이 전혀 없다. 노드 출력에 `<script>` 등 악성 문자열이 들어있어도 JSON.stringify 후 텍스트 자식(child)으로만 렌더되므로 React 가 자동 이스케이프한다. 인젝션 벡터 없음.

- **[INFO]** 대용량 payload 직렬화로 인한 메인 스레드 블로킹(로컬 성능, 보안 영향 미미)
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview`
  - 상세: `bytes` 계산이 축약 전 원본 값 전체를 `JSON.stringify` + `TextEncoder.encode` 하므로, 노드 출력이 매우 크면(예: 대용량 배열/바이너리 base64) hover 시마다 동기 직렬화 비용이 발생한다. 축약 표시(`preview`) 자체는 depth-bound(top-level만 펼침, 배열 5개/객체 20개 cap)라 안전하지만 `bytes` 산정 경로는 무제한이다. 순환 참조는 try/catch 로 방어돼 있어 크래시는 없다. 공격자가 원격에서 트리거할 수 있는 벡터는 아니며(자기 자신의 이미 로드된 데이터), 클라이언트 로컬 UX 성능 이슈에 가깝다.
  - 제안: 우선순위 낮음. 필요 시 `bytes` 도 상한 크기에서 조기 종료(예: 특정 길이 초과 시 근사치 표기)하는 최적화를 고려할 수 있다.

- **[INFO]** 툴팁 위치가 뷰포트 경계로 clamp 되지 않음(보안 영향 없음, UX 참고)
  - 위치: `workflow-canvas.tsx` `onEdgeMouseEnter`, `edge-data-preview.tsx` 의 `style={{ left: x + 12, top: y + 12 }}`
  - 상세: 화면 우측/하단 근처에서 hover 시 툴팁이 잘릴 수 있으나 이는 순수 UX 이슈이며 보안 카테고리와 무관해 참고로만 기재.

## 요약

이번 변경은 워크플로 편집기 캔버스에 순수 프런트엔드 hover 툴팁/모달(엣지 데이터 미리보기)을 추가하는 기능으로, 백엔드·API·인증/인가 경계·데이터 저장·wire 프로토콜은 전혀 건드리지 않는다. 표시 데이터는 이미 클라이언트에 로드돼 있는(동일 인증 세션의) 실행 결과 스토어에서 읽으며, 렌더링은 전 구간 React 텍스트 자식으로만 처리돼 `dangerouslySetInnerHTML`·`eval` 등 인젝션 벡터가 없다. 하드코딩 시크릿, SQL/커맨드/경로 인젝션, 인증 우회, 안전하지 않은 암호화, 민감정보 노출 에러 메시지, 신규 의존성 등 OWASP Top 10 관련 실질적 결함은 발견되지 않았다. 유일한 주목할 점은 노드 실행 출력에 우연히 민감 데이터가 섞여 있을 경우 이를 열람하기 위한 마찰(클릭 → 패널 열기)이 hover 로 낮아진다는 점인데, 이는 권한 범위 확장이 아니라 기존에 이미 접근 가능하던 데이터의 노출 경로 추가일 뿐이라 정보성으로만 기록한다.

## 위험도

NONE
