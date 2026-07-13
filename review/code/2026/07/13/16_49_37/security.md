# 보안(Security) 리뷰 — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (3-workflow-editor/2-edge §4/§5)

## 발견사항

- **[INFO]** 엣지 hover 미리보기가 노드 실행 결과(잠재적 민감 데이터)를 저마찰(hover)로 노출
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`useEdgeFlowData`, `EdgeDataPreviewTooltip`, `EdgeDataModal`), `codebase/frontend/src/lib/stores/execution-store.ts` (`findLatestResultByNodeId`)
  - 상세: 툴팁/모달은 `useExecutionStore.nodeResults`(이미 클라이언트에 로드돼 있는, 인증된 워크스페이스 사용자만 접근 가능한 실행 결과)를 `findLatestResultByNodeId` → `unwrapNodeOutput().output` 경로로 읽어 그대로 축약·전체 표시한다. HTTP Request 노드가 Authorization 헤더를 echo 하거나 통합 노드가 access token/PII 를 반환하는 워크플로라면, 종전에는 Run Results 패널을 열어야 보이던 데이터가 이제 엣지에 마우스만 올려도(그리고 `HIDE_DELAY_MS=200ms` 동안 유지되는 툴팁으로) 드러난다. 신규 인가 경계나 권한 상승은 아니다 — 동일 인증 세션·동일 워크스페이스 권한 범위 내에서 이미 store 에 존재하던 데이터이며, 서버/API/DB 접근 경로 변경이 없다. 다만 화면 공유·데모·어깨너머 관찰(shoulder-surfing) 시나리오에서 우발적 노출 마찰을 낮춘다.
  - 제안: 별도 강제 조치 불필요(기존 Run Results 패널과 노출 범위 동일). 향후 노드 출력에 시크릿 마스킹/redaction 정책이 도입되면 이 hover 경로도 함께 적용 대상에 포함할 것.

- **[INFO]** 렌더링 경로에 XSS 벡터 없음 (확인 사항, 결함 아님)
  - 위치: `edge-data-preview.tsx` `<pre>{summary.preview}</pre>`(`EdgeDataPreviewTooltip`), 재사용된 `JsonContent`(`run-results/renderers/presentation-renderers.tsx` `<pre>{JSON.stringify(data, null, 2)}</pre>`, `EdgeDataModal`이 소비)
  - 상세: `dangerouslySetInnerHTML`/`innerHTML` 대입/`eval`/문자열 기반 동적 스크립트 삽입이 전혀 없다. 노드 출력에 `<script>` 등 악성 문자열이 섞여 있어도 `JSON.stringify` 후 React 텍스트 자식(child)으로만 렌더돼 자동 이스케이프된다. `presentation-renderers.tsx` 내 다른 위치의 `sanitizeHtml`/`dangerouslySetInnerHTML` 사용부(html/markdown 렌더러)는 이번 diff 의 변경 범위 밖이며 기존 sanitize 경로를 그대로 유지, 이번 변경과 무관.
  - 제안: 해당 없음.

- **[INFO]** 크기 상한 없는 원본 직렬화(`JSON.stringify` + `TextEncoder`)가 hover 경로에서 동기 실행 — 로컬 UX 성능 이슈로, 보안 영향은 미미
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview`
  - 상세: `abbreviate()` 자체는 depth-bound(top-level 만 펼침, 배열 5개/객체 20개 cap)라 미리보기 문자열은 안전하지만, `bytes` 계산용 `JSON.stringify(value)` 는 원본 전체를 대상으로 하고 상한이 없다. 대용량 노드 출력(큰 배열·base64 바이너리 등)에서 hover 시마다 메인 스레드 동기 직렬화 비용이 발생할 수 있다. 순환 참조는 `try/catch` 로 방어돼 크래시는 없음(회귀 테스트로 검증됨, `edge-data-preview.test.ts` "순환 참조 등 직렬화 불가여도 throw 하지 않는다"). 원격 공격자가 트리거 가능한 벡터가 아니며(자기 자신의, 이미 로드된 데이터), 클라이언트 로컬 DoS 로 분류할 수준이 아니다.
  - 제안: 우선순위 낮음. 참고로 이전 라운드(`review/code/2026/07/13/15_52_56`)에서 동일 항목이 WARNING(성능 카테고리)으로 지적되었고 이번 라운드까지 미해결로 남아 있으나, 순수 성능 관점 사안이라 보안 카테고리에서는 INFO 로 유지.

- **[INFO]** 툴팁 위치가 뷰포트 경계로 clamp 되지 않음(보안 영향 없음)
  - 위치: `workflow-canvas.tsx` `onEdgeMouseEnter`(`event.clientX/clientY` 그대로 전달), `edge-data-preview.tsx` `style={{ left: x + 12, top: y + 12 }}`
  - 상세: 화면 우측/하단 근처에서 hover 시 툴팁이 잘릴 수 있으나 순수 UX 이슈이며 인젝션·정보노출과 무관.
  - 제안: 해당 없음(참고용).

## 확인된 정상 동작(결함 아님)

- 하드코딩 시크릿/API 키/비밀번호/인증서 없음 — `edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`, `execution-store.ts`, `workflow-canvas.tsx` diff 전수 확인.
- 신규 i18n 문자열(`editor.edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData`)은 `dict/ko/editor.ts`·`dict/en/editor.ts` 에 정식 등록되고 컴포넌트는 `useT()` 로만 소비한다. 하드코딩 문자열 없음(이전 라운드에서 지적된 i18n 하드코딩은 별개 카테고리(maintainability/requirement) CRITICAL 이었고, 본 diff 시점 기준 이미 해소되어 있음을 코드 레벨에서 재확인).
- SQL/커맨드/LDAP/경로 인젝션 벡터 없음 — 백엔드·DB·파일시스템·외부 프로세스 호출을 전혀 건드리지 않는 순수 프런트엔드 React 컴포넌트/훅/유틸 변경.
- 인증/인가 경계 변경 없음 — 신규 API 호출·엔드포인트·세션/토큰 관리 로직 없음. `findLatestResultByNodeId` 는 기존에 이미 클라이언트에 로드돼 있던 `nodeResults` 배열을 O(1) 인덱스로 조회하는 selector 추가일 뿐이다.
- 입력 검증/새니타이징 — 신규 사용자 입력 경로 자체가 없다(마우스 hover/클릭만). `summarizeDataForPreview` 는 임의 `unknown` 값(순환 참조 포함)에 대해 두 개의 독립적 `try/catch` 로 방어적으로 처리해 예외를 밖으로 전파하지 않는다.
- 에러 처리 경로에 민감정보 노출 없음 — 실패 시 `bytes: 0` 또는 `String(value)` 로 조용히 폴백할 뿐 스택트레이스·내부 경로·서버 에러 메시지를 노출하지 않는다.
- 암호화/해시 — 관련 코드 변경 없음.
- 의존성 보안 — 신규 외부 의존성 추가 없음(기존 `@xyflow/react`, 내부 `run-results/output-shape`·`presentation-renderers` 재사용, `execution-store` 확장). 알려진 취약점이 있는 라이브러리 도입 없음.

## 요약

이번 변경은 워크플로 편집기 캔버스에 순수 프런트엔드 hover 툴팁/모달(엣지 데이터 미리보기, spec §4/§5)을 추가하는 기능으로, 백엔드·API·인증/인가 경계·데이터 저장·wire 프로토콜을 전혀 건드리지 않는다. 표시 데이터는 이미 클라이언트에 로드돼 있는(동일 인증 세션·워크스페이스 권한 범위의) 실행 결과 스토어에서 읽으며, 렌더링은 전 구간 React 텍스트 자식으로만 처리돼 `dangerouslySetInnerHTML`/`eval` 등 인젝션 벡터가 없다. 하드코딩 시크릿, SQL/커맨드/경로/LDAP 인젝션, 인증 우회, 안전하지 않은 암호화, 민감정보 노출 에러 메시지, 알려진 취약점이 있는 신규 의존성 등 OWASP Top 10 관련 실질적 결함은 발견되지 않았다. 유일하게 주목할 점은 노드 실행 출력에 우연히 민감 데이터(토큰·PII 등)가 섞여 있을 경우 이를 열람하는 마찰이 "패널 클릭"에서 "hover"로 낮아진다는 점인데, 이는 권한 범위 확장이 아니라 기존에 이미 접근 가능하던 데이터의 노출 경로를 하나 더 추가하는 것뿐이라 정보성(INFO)으로만 기록한다. 이 결론은 동일 diff 에 대한 이전 두 리뷰 라운드(`15_52_56`, `16_20_51`)의 독립적 security 리뷰 결과(둘 다 위험도 NONE)와도 일치한다.

## 위험도

NONE
