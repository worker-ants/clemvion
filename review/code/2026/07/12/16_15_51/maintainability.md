> **복구본**: sub-agent disk write 유실(disk-write gap) — journal.jsonl 반환값 복구.

### 발견사항

- **[WARNING] 순수 포맷팅 변경과 기능 변경이 하나의 diff 에 뒤섞임**
  - 위치: `.claude/config/doc-sync-matrix.json` (전체 diff, 약 100줄+)
  - 상세: `new-widget-chrome-string` 항목 1개를 추가하는 것이 이 커밋의 실질 의도인데, 기존 모든 항목의 `trigger.globs`/`guard_tests` 배열이 한 줄(`["a", "b"]`) → 여러 줄(각 원소 별도 줄) 형식으로 전면 재포맷됐다. 이 때문에 diff 가 수십 줄 부풀려져 리뷰어가 실제 변경 지점(새 항목 1개)을 찾기 어렵고, `git blame`/`git log -p` 로 이후 이 파일을 추적할 때도 무관한 줄들이 해당 커밋에 결부된다. 아마 이 파일을 프로그램적으로 파싱→재직렬화(`JSON.stringify(data, null, 2)` 류)하는 도구를 거치면서 원래의 컴팩트 배열 스타일이 소실된 것으로 보인다.
  - 제안: (1) 향후 이 파일을 수정할 때는 기존 라인 스타일을 보존하는 Edit(부분 치환)로 처리하거나, (2) 정말 전면 재포맷이 필요하다면 그 자체를 별도의 "format only" 커밋으로 분리해 기능 변경 diff 와 섞이지 않게 한다. 이번 PR 자체를 되돌릴 필요는 없으나 재발 방지 관례로 남길 만하다.

- **[INFO] 위젯 로컬 catalog 는 DRY·SoT 원칙을 잘 지킴**
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`, `codebase/channel-web-chat/src/widget/components/panel.tsx` (`CONFIRM_COPY`), `codebase/channel-web-chat/src/widget/use-widget.ts` (`GENERIC_ERROR_MESSAGE = WIDGET_STRINGS.ko["error.generic"]`)
  - 상세: 기존에는 `panel.tsx`(CONFIRM_COPY), `use-widget.ts`(GENERIC_ERROR_MESSAGE) 등에 문자열 리터럴이 중복 하드코딩돼 있었는데, 이번 변경으로 전부 `catalog.ts` 의 단일 키 참조로 수렴했다(`messageKey`/`confirmLabelKey` 패턴, `WIDGET_STRINGS.ko[...]` 재사용). 중복 문자열이 여러 곳에 흩어져 드리프트를 유발하던 구조가 단일 진실 원천으로 개선됐다. 조치 불필요, 긍정적 패턴으로 기록.

- **[INFO] `t()` 중첩 호출로 인한 약간의 인지 부하**
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:107` 부근 — `aria-label={t("confirm.yesAria", { label: t(CONFIRM_COPY[confirming].confirmLabelKey) })}`
  - 상세: 번역된 문자열을 다시 다른 번역 호출의 보간 파라미터로 사용하는 중첩 패턴. 기능적으로는 올바르고 (`{{label}} 확정` / `Confirm {{label}}`) EN/KO 양쪽 어순 차이를 흡수하기 위한 의도된 설계지만, 한 줄에 두 단계 번역 호출이 들어가 있어 가독성이 살짝 떨어진다.
  - 제안: 필요 시 `const confirmLabel = t(CONFIRM_COPY[confirming].confirmLabelKey); const yesAria = t("confirm.yesAria", { label: confirmLabel });` 처럼 중간 변수로 분리하면 더 읽기 쉽다. 다만 현재도 이해 가능한 수준이라 강제 조치는 아님.

- **[INFO] flat dot-key 네임스페이스(`"composer.placeholder"` 등) 관례**
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`
  - 상세: 중첩 객체(`{ composer: { placeholder: ... } }`) 대신 점(`.`)이 포함된 단일 레벨 문자열 키를 쓰는 방식이다. 이는 접근 시 항상 브래킷 표기 `t("composer.placeholder")` 를 요구하지만, `as const` + `keyof typeof WIDGET_STRINGS.ko` 로 타입 안전성이 보장되어(오타는 컴파일 에러) 실질적 유지보수 리스크는 낮다. 파일 상단 주석에서 "메인 앱 dict 와 분리된 위젯 전용 경량 경로" 임을 명시해 의도도 명확하다. 문제 아님, 참고 기록만.

- **[INFO] `presentations.tsx` 에서 `useTranslation()` 훅이 4개 서브 컴포넌트에 각각 호출됨**
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` (`CarouselView`, `TableView`, `CartesianChart`, `PieChart`)
  - 상세: 형태상 중복처럼 보이지만 React 훅 규칙상 각 함수 컴포넌트에서 독립적으로 호출하는 것이 정상 패턴이며 prop-drilling 보다 낫다. 실질적 중복 코드 문제 아님.

### 요약
이번 변경(channel-web-chat 위젯 chrome i18n 도입)의 실제 코드(`catalog.ts`/`resolve-locale.ts`/`context.tsx`/`index.ts` 및 컴포넌트 배선)는 작은 함수·명확한 네이밍·풍부한 근거 주석·단일 진실 원천(catalog) 패턴을 일관되게 유지해 유지보수성 관점에서 우수하다. 순환 복잡도·중첩 깊이·매직 넘버 문제는 발견되지 않았고, 기존에 여러 곳에 흩어져 있던 문구 리터럴(CONFIRM_COPY, GENERIC_ERROR_MESSAGE)을 catalog 참조로 통합해 중복을 오히려 줄였다. 유일하게 지적할 만한 점은 코드가 아닌 `.claude/config/doc-sync-matrix.json` 의 대규모 순수 포맷팅 변경이 기능 변경(신규 항목 1개)과 뒤섞여 diff 가독성·blame 추적성을 떨어뜨린다는 것이며, 이는 차단 사유는 아니고 관례 개선 권고 수준이다.

### 위험도
LOW
