# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 엣지 호버 미리보기가 노드 실행 결과(잠재적 민감 데이터)를 저마찰(hover)로 노출
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`useEdgeFlowData`, `EdgeDataPreviewTooltip`, `EdgeDataModal`)
  - 상세: 툴팁/모달은 `useExecutionStore.nodeResults`(이미 클라이언트에 로드된, 인증된 워크스페이스 사용자만 접근 가능한 실행 결과)를 `findLatestResultByNodeId` → `unwrapNodeOutput().output` 경로로 그대로 읽어 축약·전체 표시한다. 노드 출력에 자격증명·PII·내부 응답 헤더 등이 그대로 흘러드는 워크플로(예: HTTP Request 노드가 Authorization 헤더를 echo, 통합 노드가 반환하는 access token)라면, 종전에는 Run Results 패널을 열어야 볼 수 있던 데이터가 이제 엣지에 마우스만 올려도(그리고 200ms `HIDE_DELAY_MS` 동안 유지되는 툴팁으로) 노출된다. 권한 상승이나 신규 데이터 접근 경로는 아니다(동일 인증 세션·동일 워크스페이스 권한 범위 내 데이터, 이미 store 에 존재) — 다만 화면 공유·데모·어깨너머 관찰(shoulder-surfing) 시나리오에서 우발적 노출 가능성을 다소 높인다.
  - 제안: 별도 강제 조치 불필요(기존 Run Results 패널과 노출 범위 동일, 신규 인가 경계 없음). 향후 노드 출력에 시크릿 마스킹/redaction 정책이 도입되면 이 hover 경로도 함께 적용 대상에 포함할 것.

- **[INFO]** 렌더링 경로에 XSS 벡터 없음 (확인 사항, 결함 아님)
  - 위치: `edge-data-preview.tsx` 의 `<pre>{summary.preview}</pre>`; 재사용된 `JsonContent`(`codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx:104-110`, `<pre>{JSON.stringify(data, null, 2)}</pre>`)
  - 상세: 두 렌더 경로 모두 `dangerouslySetInnerHTML`/`innerHTML` 대입/`eval`/문자열 기반 동적 스크립트 삽입이 전혀 없다. 노드 출력에 `<script>` 등 악성 문자열이 섞여 있어도 `JSON.stringify` 후 React 텍스트 자식(child)으로만 렌더돼 자동 이스케이프된다. 참고로 같은 파일의 `sanitizeHtml`/`dangerouslySetInnerHTML` 사용부(html/markdown 프레젠테이션 렌더러, L434/L444)는 이번 diff 의 변경 범위 밖이며 기존 sanitize 경로를 그대로 유지한다.
  - 제안: 해당 없음.

- **[INFO]** 대용량 payload 직렬화로 인한 메인 스레드 블로킹(로컬 성능, 보안 영향 미미)
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview`
  - 상세: `bytes` 계산이 축약 전 원본 값 전체를 `JSON.stringify` + `TextEncoder.encode` 하므로, 노드 출력이 매우 크면(대용량 배열/base64 바이너리) hover 시마다 동기 직렬화 비용이 발생한다. 축약 표시(`preview`)는 depth-bound(top-level 만 펼침, 배열 5개/객체 20개 cap)라 안전하지만 `bytes` 산정 경로는 무제한이다. 순환 참조는 try/catch 로 방어돼 크래시는 없다(`summarizeDataForPreview` 테스트로 회귀 검증됨). 원격 공격자가 트리거 가능한 벡터는 아니며(자기 자신의 이미 로드된 데이터), DoS 로 분류할 수준은 아니다.
  - 제안: 우선순위 낮음. 필요 시 특정 길이 초과 시 근사치로 조기 종료하는 최적화 고려 가능.

- **[INFO]** 툴팁 위치가 뷰포트 경계로 clamp 되지 않음(보안 영향 없음)
  - 위치: `workflow-canvas.tsx` `onEdgeMouseEnter`, `edge-data-preview.tsx` `style={{ left: x + 12, top: y + 12 }}`
  - 상세: 화면 우측/하단 근처 hover 시 툴팁이 잘릴 수 있으나 순수 UX 이슈이며 보안 카테고리와 무관.
  - 제안: 해당 없음(참고용).

## 확인된 정상 동작(결함 아님)

- 하드코딩 시크릿/API 키/인증서 없음 (`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`, `execution-store.ts`, `workflow-canvas.tsx` diff 전수 grep 확인).
- 신규 i18n 문자열(`editor.edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData`)은 `dict/{ko,en}/editor.ts` 로 정식 등록되고 `useT()` 로만 소비됨 — 이전 라운드(`review/code/2026/07/13/15_52_56`)에서 지적된 하드코딩 문자열 CRITICAL 은 이번 diff(`RESOLUTION.md` 반영분)에서 실제로 해소되어 있음을 코드 레벨에서 재확인함.
- SQL/커맨드/LDAP/경로 인젝션 벡터 없음 — 이번 변경은 백엔드·DB·파일시스템·외부 프로세스 호출을 전혀 건드리지 않는 순수 프런트엔드 React 컴포넌트/훅/유틸이다.
- 인증/인가 경계 변경 없음 — `useExecutionStore` 는 기존에 이미 클라이언트에 로드돼 있던 데이터를 읽는 selector 추가(`findLatestResultByNodeId`)일 뿐, 신규 API 호출·신규 서버 엔드포인트·권한 검사 로직 변경이 없다.
- 에러 처리 경로에 민감정보 노출 없음 — `summarizeDataForPreview`/`JSON.stringify` 의 `try/catch` 는 실패 시 `bytes: 0` 또는 `String(value)` 로 조용히 폴백할 뿐 스택트레이스·내부 경로 등을 노출하지 않는다.
- 신규 의존성 추가 없음(기존 `@xyflow/react`, 내부 `run-results` 모듈 재사용) — 알려진 취약점이 있는 라이브러리 도입 없음.
- 암호화/해시 관련 코드 변경 없음.

## 요약

이번 변경은 워크플로 편집기 캔버스에 순수 프런트엔드 hover 툴팁/모달(엣지 데이터 미리보기, spec §4/§5)을 추가하는 기능으로, 백엔드·API·인증/인가 경계·데이터 저장·wire 프로토콜은 전혀 건드리지 않는다. 표시 데이터는 이미 클라이언트에 로드돼 있는(동일 인증 세션·워크스페이스 권한 범위의) 실행 결과 스토어에서 읽으며, 렌더링은 전 구간 React 텍스트 자식으로만 처리돼 `dangerouslySetInnerHTML`/`eval` 등 인젝션 벡터가 없다. 하드코딩 시크릿, SQL/커맨드/경로 인젝션, 인증 우회, 안전하지 않은 암호화, 민감정보 노출 에러 메시지, 알려진 취약점이 있는 신규 의존성 등 OWASP Top 10 관련 실질적 결함은 발견되지 않았다. 이전 라운드에서 지적된 i18n 하드코딩 CRITICAL(보안 카테고리는 아니었으나 관련 파일)은 이번 diff 에서 `useT()` 전환으로 해소된 상태임을 코드 레벨에서 재확인했다. 유일하게 주목할 점은 노드 실행 출력에 우연히 민감 데이터(토큰·PII 등)가 섞여 있을 경우 이를 열람하는 마찰이 "패널 클릭"에서 "hover"로 낮아진다는 점인데, 이는 권한 범위 확장이 아니라 기존에 이미 접근 가능하던 데이터의 노출 경로 추가일 뿐이라 정보성(INFO)으로만 기록한다.

## 위험도

NONE
