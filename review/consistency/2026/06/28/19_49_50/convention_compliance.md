# 정식 규약 준수 검토 — `plan/in-progress/webhook-spec-pointer-cleanup.md`

검토 모드: spec draft (--spec)
검토일: 2026-06-28

---

## 발견사항

### [INFO] frontmatter 에 비표준 필드 `branch` 포함

- **target 위치**: 파일 상단 frontmatter (라인 5 `branch: claude/webhook-spec-pointer-cleanup-215f48`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` 및 `.claude/docs/plan-lifecycle.md §4` — 필수 3필드 (`worktree`/`started`/`owner`) 외 추가 필드는 `priority`/`status`/`title` 등 예시로 제시되며, `branch` 필드는 공식 언급 없음
- **상세**: `plan-lifecycle.md §4` 는 "세 필드(`worktree`·`started`·`owner`)는 필수, 추가 필드는 허용" 이라고 명시한다. `branch` 필드 추가 자체는 허용 범주에 속하므로 build 가드 위반은 아니다. 다만 규약이 예시로 든 추가 필드(`priority`/`status`/`title`) 목록에 `branch` 는 없으며, branch 정보는 `worktree` 필드(슬러그)로부터 암묵적으로 식별 가능하다. 이중 정보 관리 부담은 미미하나, 규약 예시와의 거리감이 있다.
- **제안**: `branch` 필드 제거 또는 유지 중 선택. 유지 시 plan-lifecycle §4 의 "허용 추가 필드" 예시 목록에 `branch` 를 추가하여 규약을 갱신하는 방안도 가능.

---

### [INFO] 상대 경로 링크의 기준 디렉토리 불일치 가능성

- **target 위치**: `## 범위` — P-1 링크 `../../spec/5-system/3-error-handling.md`, P-2 링크 `../../spec/5-system/12-webhook.md#6-구현-파일-구조`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` 는 `spec/**.md` 본문 in-repo 링크의 타깃 존재 + anchor slug 대조를 강제한다. Plan 문서(`plan/in-progress/`) 링크 무결성은 `plan-coherence` 담당으로 분리되어 있으나, plan 문서가 `spec/` 문서를 내부 링크로 참조할 때 `../../` 상대경로는 plan 파일의 실제 위치에서 올바르게 해석되어야 한다.
- **상세**: `plan/in-progress/webhook-spec-pointer-cleanup.md` 에서 `../../spec/5-system/3-error-handling.md` 는 repo 루트 기준으로 `spec/5-system/3-error-handling.md` 를 가리킨다. `spec-link-integrity.test.ts` 의 검증 대상은 `spec/**.md` 이므로 이 plan 파일의 링크는 그 가드의 범위 밖이다. 실질적 링크 오판 위험은 낮지만, 규약 상 plan 링크 무결성을 별도로 보장하는 가드가 없으므로 링크가 잘못되어도 build-time 에 탐지되지 않는다.
- **제안**: 링크 목적지(`spec/5-system/3-error-handling.md`, `spec/5-system/12-webhook.md`)가 실재하는지 작성자가 수동 확인한다. 변경 없이 유지 가능.

---

### [INFO] 문서 구조 — 3섹션 구성(Overview/본문/Rationale) 미적용

- **target 위치**: 파일 전체 구조
- **위반 규약**: CLAUDE.md "정보 저장 위치" — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`". 각 SKILL.md 에서 "Spec 문서 3섹션 구성(Overview/본문/Rationale) 권장"을 언급
- **상세**: 대상 파일은 `plan/in-progress/` 문서이지 `spec/` 문서가 아니다. 3섹션 구성 권장은 spec 문서에 적용되는 것이며, plan 문서에 대한 명시적 3섹션 의무는 존재하지 않는다. 따라서 위반 아님 — 적용 불가 항목을 명확히 하기 위해 INFO 로 기록.
- **제안**: 해당 없음. plan 문서는 체크리스트·범위·워크플로 구조가 적합하다.

---

### [WARNING] P-2 링크 anchor 포인트가 타깃 섹션과 불일치 가능성

- **target 위치**: P-2 라인 — `[12-webhook §6](../../spec/5-system/12-webhook.md#6-구현-파일-구조)`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` 는 `#anchor` heading slug 를 실제 렌더러(`rehype-slug`=`mdast`+`github-slugger`) 파이프라인과 대조한다. 단 이 가드는 `spec/**.md` 내 링크에만 적용되며, plan 파일 내 링크는 대상이 아님
- **상세**: plan 파일 본문에서 `spec/5-system/12-webhook.md#6-구현-파일-구조` 를 SoT 로 지정하고 있다. 이 anchor 가 `12-webhook.md` 의 실제 섹션 제목과 일치하지 않으면, 향후 이 plan 을 참조하는 개발자가 잘못된 위치로 이동한다. 규약 가드 범위 밖이지만, P-2 작업 항목의 SoT 참조 정확성에 영향을 준다.
- **제안**: `spec/5-system/12-webhook.md` 를 직접 확인하여 `## 6 구현 파일 구조` (또는 동등한 한국어 섹션 heading) 가 존재하는지 검증한다. 섹션이 없거나 anchor slug 가 다르다면 수정한다.

---

## 요약

`plan/in-progress/webhook-spec-pointer-cleanup.md` 는 `plan-lifecycle.md §4` 의 필수 frontmatter 필드(`worktree`/`started`/`owner`) 를 모두 충족하며, `plan-frontmatter.test.ts` build 가드를 통과하는 구성이다. 문서 구조는 plan 문서 관례(범위/워크플로/범위 밖)를 따르고 있으며, spec 3섹션 의무(Overview/본문/Rationale)는 plan 문서에 적용되지 않으므로 위반 없음. 비표준 `branch` 필드가 frontmatter 에 포함되어 있으나 추가 필드 허용 범위에 해당한다. P-2 의 anchor 링크 정확성은 가드 범위 밖이므로 수동 검증이 권장된다. 전반적으로 정식 규약 직접 위반은 없으며 낮은 위험 수준이다.

## 위험도

LOW
