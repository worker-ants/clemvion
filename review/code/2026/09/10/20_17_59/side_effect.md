# 부작용(Side Effect) 리뷰

## 대상 개요

이 변경은 애플리케이션 코드가 아니라 **의존성 버전/거버넌스 산출물**만 건드린다: `pnpm-workspace.yaml`
(overrides) · `pnpm-lock.yaml` (재해소) · 3개 `package.json` (직접 의존 상향) ·
`scripts/check-pnpm-security-config.py` (baseline 미러) · `CHANGELOG.md` / 신규 plan 문서.
함수 시그니처·전역 변수·이벤트/콜백·환경 변수·네트워크 호출 코드 경로는 diff 에 존재하지 않는다.
따라서 이번 리뷰는 "버전 교체가 의도치 않은 하위 트리/거버넌스 정합을 깨는지"에 초점을 맞췄다.

## 검증한 내용 (저장소 비-뮤테이션, `grep`/`Read` 만 사용)

- `pnpm-workspace.yaml` 의 overrides 변경분과 `scripts/check-pnpm-security-config.py` 의
  `EXPECTED_OVERRIDES` 를 대조 — `fast-uri`·`hono`·`multer`·`nodemailer`·`qs`(신설)·`svgo`·`sharp`·
  `js-yaml` 두 스코프 키 모두 **양쪽이 정확히 일치**한다(2-place 편집 규약 준수, §2 gate 목적대로 동작).
- 신설 unscoped override `qs: ^6.16.0` 이 실제로 워크스페이스 전역에 몇 곳에서 해소되는지
  `pnpm-lock.yaml` 을 전수 grep 했다 — `qs@6.16.0` 소비자는 `body-parser`(→`express` 경유) ·
  `express` 직접 · `superagent`(→`supertest` 경유) **세 곳뿐**이며, CHANGELOG/plan 문서가 명시한
  "express(prod)·superagent(dev) 두 경로" 설명과 일치한다. unscoped override 가 문서화되지 않은
  제3의 소비자를 조용히 끌어올리는 정황은 없었다.
- CHANGELOG 가 "버전 하향 0건" 이라고 주장한 `@radix-ui/react-use-escape-keydown@1.1.2` 완전 소실
  claim 을 `pnpm-lock.yaml` 에서 직접 확인 — `@radix-ui/react-dismissable-layer@1.1.19` 의
  `dependencies` 블록에 더 이상 `react-use-escape-keydown` 참조가 없고
  (`react-use-callback-ref`/`react-use-effect-event` 로 대체) 트리 내 유일 소비자였던 1.1.13 이
  1.1.19 로 흡수되며 함께 빠진 것을 실측으로 확인했다. 쓰이던 패키지가 조용히 빠진 것이 아니다.
- `CHANGELOG.md` 최상단에 새 `## Unreleased` 섹션이 추가되어 기존 `## Unreleased` 섹션과 나란히
  스택된다 — `grep '^## Unreleased' CHANGELOG.md` 로 이 저장소가 PR 마다 별도 `## Unreleased`
  헤더를 쌓는 기존 컨벤션(기존에도 10개 이상 존재)임을 확인. 중복 헤더가 아니라 정상 패턴이다.

## 발견사항

- **[INFO]** `next` 마이너 버전 상향(`^16.2.12` → `^16.3.3`, `codebase/frontend`·`codebase/channel-web-chat`
  양쪽)은 코드 diff 로는 드러나지 않는 프레임워크 런타임 동작 변경 표면이다(라우팅/캐싱/미들웨어
  기본값 등 Next 마이너 릴리스가 종종 바꾸는 영역).
  - 위치: `codebase/frontend/package.json:52`, `codebase/channel-web-chat/package.json:17` — 함수명 없음, dependency 선언 라인.
  - 상세: 이 변경 자체의 부작용은 아니지만, "side effect" 관점에서는 정적 diff 리뷰가 못 보는 유일한 표면이다. plan 체크리스트에 build/e2e(playwright 51 passed) 가 기록돼 있어 회귀는 실측으로 어느 정도 커버됐지만, Next 자체의 changelog(breaking/behavior change 항목) 대조는 plan 본문에 명시돼 있지 않다.
  - 제안: 정보 제공 목적 — 별도 조치 불필요. 향후 Next 마이너 상향 시 릴리스 노트의 breaking/behavior 섹션 대조를 plan 체크리스트 항목으로 남기면 다음 사람이 반복 조사를 줄일 수 있다.

- **[INFO]** `qs` override 는 `pnpm-workspace.yaml` 상 scope 미지정(unscoped) 이라 워크스페이스 전체의 모든 `qs` 소비자에 전역 적용된다.
  - 위치: `pnpm-workspace.yaml` (overrides 블록, `qs: ^6.16.0` 신설 줄 — unified diff 게이트 `92`)
  - 상세: 문서(CHANGELOG·plan)는 `express`(prod)·`superagent`(dev) 두 경로만 근거로 든다. 본 리뷰에서 `pnpm-lock.yaml` 을 전수 대조해 실제 소비자가 그 두 경로(+ `express` 의 하위인 `body-parser`)뿐임을 확인했으므로 **현재는 부작용이 아니다**. 다만 unscoped override 의 일반적 성격상, 향후 다른 워크스페이스가 `qs` 에 의존을 추가하면 리뷰 없이도 이 override 가 조용히 적용된다 — 설계상 의도된 pnpm override 동작이며 이 PR 의 결함은 아니다.
  - 제안: 조치 불필요. 참고용 기록.

## 요약

이 변경은 애플리케이션 로직·함수 시그니처·전역 상태·이벤트/콜백·환경 변수·네트워크 호출 코드를 전혀 건드리지 않는 순수 의존성 버전/거버넌스 동기화 PR이다. override 값 변경(`pnpm-workspace.yaml`)과 그 baseline 미러(`scripts/check-pnpm-security-config.py`)가 정확히 일치함을 직접 대조로 확인했고, CHANGELOG/plan 이 주장하는 "무해한 재해소"(중복 제거로 인한 하위 패키지 흡수·소실)도 `pnpm-lock.yaml` 실측으로 검증되어 근거 없는 주장이 아니었다. 유일하게 정적 diff 로 완전히 커버되지 않는 표면은 `next` 프레임워크 마이너 상향의 런타임 동작 변화이나, 이는 이 변경 고유의 결함이 아니라 의존성 업그레이드 일반의 잔여 리스크이고 build/e2e 통과로 상당 부분 실측 커버됐다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
