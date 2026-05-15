### 발견사항

- **[WARNING]** 프로젝트 규약 위반 — 다단 JSDoc 블록
  - 위치: `graph-3d-renderer.tsx:49-60`
  - 상세: CLAUDE.md 는 "Never write multi-paragraph docstrings or multi-line comment blocks — one short line max" 를 명시. 현재 9줄짜리 블록 주석은 이 규약을 직접 위반한다. 내용 자체는 유용하지만 형식이 규약에 맞지 않는다.
  - 제안: 디자인 결정 4개 항목은 PR 설명으로 이동하고 컴포넌트 상단에는 "SSR 불가 이유"만 한 줄 남긴다.

- **[WARNING]** `TYPE_COLOR` 중복 — 분기 위험 미문서화
  - 위치: `graph-visualization.tsx:15-22`, `graph-3d-renderer.tsx:15-22`
  - 상세: 두 파일에 동일한 객체 리터럴이 복사돼 있고, `graph-visualization.tsx` 주석이 "3D 노드 material 과 동일"이라고 인정만 할 뿐 왜 추출하지 않았는지 설명이 없다. 향후 한쪽만 수정되면 legend 색과 3D 노드 색이 조용히 어긋난다.
  - 제안: `// intentional copy — import cycle 방지. dynamic import 경계를 넘지 않으므로 barrel export 불가` 등 이유를 한 줄 추가하거나, 공용 상수 파일로 추출한다.

- **[WARNING]** 매직 넘버 무문서화
  - 위치: `graph-3d-renderer.tsx:91` (`1200`), `graph-3d-renderer.tsx:111` (`zoomToFit(400, 60)`), `graph-3d-renderer.tsx:128` (`distance = 60`), `graph-3d-renderer.tsx:118` (`sprite.position.set(0, 8, 0)`)
  - 상세: `1200`ms 는 "1000ms 정도 안정화 대기"라고 useEffect 위 주석에서 근거가 언급되나 실제 값이 1000이 아닌 1200인 이유가 불분명하다. `distance = 60`, `zoomToFit(400, 60)` 의 두 인자, sprite Y 오프셋 `8` 은 완전히 무설명이다.
  - 제안: named constant 로 추출(`const CAMERA_ZOOM_PADDING_MS = 1200`) 하거나 한 줄 주석으로 도출 근거를 기록한다.

- **[INFO]** `VIEWPORT_HEIGHT = 600` 무근거
  - 위치: `graph-visualization.tsx:37`
  - 상세: 600px 이 UX 판단인지, 디자인 토큰 기반인지, 임의값인지 알 수 없다.
  - 제안: `// px — 사이드바 제외 최소 뷰포트 확보` 수준 한 줄이면 충분.

- **[INFO]** 로딩 문구 i18n 누락
  - 위치: `graph-visualization.tsx:29` (`"Loading 3D graph…"`)
  - 상세: 파일 내 모든 사용자 노출 문자열이 `t()` 를 거치는데 이 placeholder 만 하드코딩 영문이다. 문서화 관점에서 i18n 키 목록에 누락된 것으로, 향후 번역 추가 시 발견하기 어렵다.
  - 제안: `t("knowledgeBases.graph3dLoading")` 로 교체하고 i18n 리소스 파일에 키를 추가한다.

- **[INFO]** 스펙 문서 업데이트 품질 양호
  - 위치: `spec/2-navigation/5-knowledge-base.md:144-146`
  - 상세: 2D → 3D 전환 이유(노드 200+ 규모에서 가독성 저하)를 blockquote 로 인라인 기록한 점은 스펙 문서 관리 관점에서 잘 됐다. 설계 결정의 맥락이 코드 이력이 아닌 스펙에 보존된다.

- **[INFO]** README 미갱신
  - 위치: 프로젝트 루트 / `frontend/` README
  - 상세: `three.js` 는 ~540KB(gzipped ~150KB) 규모의 의존성으로, 번들 크기가 의미 있게 증가한다. WebGL 지원이 필요한 기능이므로, README 에 "Knowledge Graph 시각화는 WebGL 지원 브라우저 필요" 한 줄을 추가할 필요가 있다.
  - 제안: `README.md` 의 요구사항 또는 기능 목록 섹션에 WebGL 요건 추가.

---

### 요약

전체적으로 문서화 수준은 양호하다. 스펙 파일이 구현 변경에 맞춰 갱신됐고, 테스트 파일 주석은 mock 전략의 이유를 명확히 설명한다. 다만 프로젝트 CLAUDE.md 규약("one short line max comment")을 위반하는 다단 JSDoc 블록이 존재하고, `TYPE_COLOR` 중복에 대한 유지보수 위험이 주석으로 명시되지 않았으며, `1200ms`/`distance=60` 등 비자명한 매직 넘버가 문서 없이 남아 있다. 이 세 가지를 정리하면 문서화 품질은 충분한 수준이 된다.

### 위험도

**LOW**