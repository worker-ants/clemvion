# 성능(Performance) 리뷰 결과

## 발견사항

### [INFO] PieSlices: starts 배열 계산이 O(n²) prefix-sum
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `PieSlices` 컴포넌트 내 `starts` 계산 (라인 280-282)
- 상세: `starts[i]` 를 계산하기 위해 `pts.slice(0, i).reduce(...)` 를 호출한다. 이는 각 슬라이스마다 i번의 합산을 반복하므로 전체 O(n²) 시간 복잡도를 가진다. 코드 주석에도 "n 작아 O(n²) 무해" 라고 인정되어 있다. 파이 차트 슬라이스 수는 일반적으로 10개 미만이므로 실제 성능 영향은 미미하나, 코드 명확성 측면에서 개선 여지가 있다.
- 제안: 단순한 누적 합산(O(n) prefix-sum)으로 변경 가능하다. `let acc = 0; const starts = pts.map((p) => { const s = acc; acc += Math.max(0, p.value) / total; return s; });` 패턴이 더 명확하고 효율적이다. 현재 슬라이스 수 규모에서는 긴급하지 않음.

### [INFO] EmbedConfigService.resolve — trigger → workspace 순차 2-hop DB 조회 (캐싱 없음)
- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` — `resolve()` 메서드 (라인 346-368)
- 상세: `GET /api/hooks/:endpointPath/embed-config` 엔드포인트는 매 호출 시 (1) trigger 조회, (2) workspace 조회로 2회의 DB 라운드트립이 발생한다. 컨트롤러에서 `Cache-Control: public, max-age=300` 를 설정하고 있어 CDN/프록시 레이어 캐싱은 지원하지만, 서버 레벨 인메모리 캐싱은 없다. 위젯 부팅 시마다 호출되고 캐시 부재(Cache MISS) 상황에서는 요청마다 DB 쿼리 2회가 발생한다.
- 제안: 서버 레벨에서는 현재 구조가 SELECT 결과가 소형이고 NestJS `CacheModule`(TTL 5분) 또는 Redis 캐시를 추가하면 캐시 HIT 시 DB 쿼리를 완전히 생략할 수 있다. 단, `select: { workspaceId: true }` 와 `select: { settings: true }` 로 필요한 컬럼만 조회하고 있어 쿼리 자체는 이미 경량화되어 있다. 현재 `Cache-Control: max-age=300` CDN 레이어 캐싱에 의존하는 설계라면 허용 가능한 수준.

### [INFO] _ensure_web_chat_deps 중복 호출 — lint/unit/build 각각 별도 실행
- 위치: `.claude/test-stages.sh` — `cmd_lint`, `cmd_unit`, `cmd_build` 함수
- 상세: `_ensure_web_chat_deps` 는 `cmd_lint`, `cmd_unit`, `cmd_build` 에서 각각 호출된다. 동일 CI job에서 lint → unit → build 순서로 실행될 경우, 첫 번째 호출 이후 `node_modules` 가 존재하므로 두 번째·세 번째 호출은 `[ -d node_modules ]` 조건에 의해 no-op이 된다. 별도 stage가 독립적으로 실행될 경우에도 각 stage가 자립하도록 설계된 것이므로 기능상 올바르다. 다만 순차 실행 시 세 번 체크되는 경미한 중복이다.
- 제안: 현재 설계 의도(각 stage 자립)가 명확하므로 변경 불필요. 성능 영향 없음.

### [INFO] classifyPresentation — 매 렌더마다 shape 판별 및 변환 함수 재계산 (캐싱 없음)
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `PresentationBlock` (라인 24-37), 각 View 컴포넌트 내 변환 함수 호출
- 상세: `PresentationBlock` 렌더 시마다 `classifyPresentation(payload)` → 해당 `toCarousel/toTable/toChart/toTemplate(payload)` 변환이 매 렌더마다 실행된다. React 리렌더링(예: 카루셀 nav 클릭으로 `idx` state 갱신)이 일어날 때 상위 컴포넌트부터 재렌더되며 변환 함수가 반복 호출된다. 변환 함수들은 순수 함수로 side-effect 없으므로 `useMemo` 로 메모화 가능하다. presentations 배열이 대부분 작고(수 개 이내) 변환 자체가 경량이어서 실제 성능 영향은 미미하다.
- 제안: `CarouselView`, `TableView`, `ChartView`, `TemplateView` 내에서 변환 결과를 `useMemo` 로 감싸는 것을 고려할 수 있으나, 현재 규모에서는 최적화 비용 대비 이득이 작다. 필요 시 향후 개선 후보.

### [INFO] TableView — columns 미제공 시 Object.keys(rows[0]) 동적 컬럼 생성이 렌더마다 반복
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `TableView` (라인 155-157)
- 상세: `columns.length` 가 0일 경우 `Object.keys(rows[0] ?? {})` 로 첫 번째 행에서 동적으로 컬럼을 추출한다. 이는 렌더마다 반복 실행될 수 있다. 행 수가 수백 개이거나 키가 많은 경우 `Object.keys` 비용이 누적될 수 있으나, 위젯 표시 규모에서는 무해하다.
- 제안: `useMemo` 로 `cols` 계산을 메모화할 수 있으나 현재 규모에서 최적화 필요성은 낮다.

### [INFO] widget boot 시 embed-config fetch가 매 boot 이벤트마다 실행
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `applyConfig` 함수 (라인 303-323)
- 상세: `onBoot` 핸들러가 호출될 때마다 `isEmbedAllowed` → `fetchEmbedConfig` → fetch 네트워크 호출이 발생한다. 일반적으로 boot는 1회이나, 호스트에서 `wc:boot` 이벤트를 중복 발송하는 경우 중복 fetch가 발생할 수 있다. 서버 응답에 `Cache-Control: max-age=300` 이 설정되어 있으므로 브라우저 HTTP 캐시에 의해 실제 네트워크 요청은 캐시 활용 가능하다.
- 제안: 브라우저 HTTP 캐시 동작에 의존하는 설계로 현재 수용 가능. 추가 클라이언트 레벨 캐싱 불필요.

## 요약

이번 변경(임베드 allowlist soft 검증 + rich presentation 렌더 + 토큰 자동 갱신)은 성능 관점에서 전반적으로 양호하다. `EmbedConfigService.resolve` 는 서버 레벨 DB 조회 2-hop이 발생하나 컨트롤러의 `Cache-Control: public, max-age=300` 설정으로 CDN/브라우저 캐시를 활용하도록 설계되어 있어 허용 가능한 수준이다. `presentation.ts` 의 변환 함수들은 불필요한 메모리 할당 없이 순수 함수로 구현되었고 Set 기반 O(1) lookup(`CAROUSEL_LAYOUTS`, `CHART_TYPES`)을 활용하고 있다. `PieSlices` 의 O(n²) prefix-sum은 코드 자체에도 명시되어 있고 실제 슬라이스 수가 적어 무해하다. 토큰 갱신 스케줄러는 단일 타이머를 재사용하고 언마운트/종료 시 적절히 정리되어 메모리 누수 위험이 없다. 전체 위험도는 NONE 수준이며, INFO 항목들은 미래 확장 시 참고할 최적화 후보들이다.

## 위험도

NONE

---

STATUS=success ISSUES=6
