# 의존성(Dependency) 리뷰 — deps-audit-floor-refresh-2026-09

## 검증 방법

정적 diff 판독에 더해, 이 워크트리에서 실제로 재현 검증을 수행했다(저장소 파일은 수정하지 않음, 실행만):

- `pnpm audit --audit-level=moderate` → **exit 0, No known vulnerabilities found** (CHANGELOG·plan 의 "25건 → 0건" 주장과 일치)
- `python3 scripts/check-override-floors.py` → exit 0 (override 대상 30개, 재유입 0건)
- `python3 scripts/check-pnpm-security-config.py` → exit 0 (overrides 33건 값까지 baseline 일치)
- `python3 scripts/check-unmet-peers.py` → exit 0 (미충족 peer 2건, 전부 기존 수용 항목 — `nunjucks→chokidar`, `typeorm→ioredis`. 이번 PR 이 새로 만든 peer 충돌 0건)
- `pnpm-lock.yaml` 전체 diff(981줄)를 스크립트로 파싱해 패키지별 최대-제거버전 vs 최대-추가버전을 semver 비교 → **95개 변경 패키지 중 다운그레이드 의심 0건**(CHANGELOG 의 "버전 하향은 0건" 주장을 전수 대조로 재확인, CHANGELOG 자체는 `@radix-ui/*` 11개·`postcss` 만 예시로 들었으나 전체 트리 기준으로도 성립)
- `@radix-ui/react-use-escape-keydown@1.1.2` 제거 주장을 diff 에서 직접 대조 — 해당 항목은 트리에서 완전히 사라졌고 유일 소비자였던 `react-dismissable-layer@1.1.13` 이 `1.1.19` 로 밀려나며 함께 빠짐(주장과 일치)
- `postcss@8.5.25` 삭제 / `postcss@8.5.26` 유지도 "이미 있던 상위 버전으로 흡수" 주장과 일치(다운그레이드 아님)
- `qs` override(`^6.16.0`)가 `express`·`superagent` 두 소비 경로 전부(backend prod + dev)에서 일관되게 적용됨을 lockfile 상 4개 좌표(패키지 선언부 2 + 소비부 2)로 확인

## 발견사항

- **[INFO]** `pnpm-lock.yaml` diff 981줄 중 상당수가 이번 PR 이 건드리지 않은 패키지의 `libc:` 메타데이터 필드 소실(예: `lightningcss-linux-*-{gnu,musl}`, `@napi-rs/canvas-linux-*`, `@rolldown/binding-linux-*`, `@tailwindcss/oxide-linux-*`, `@unrs/resolver-binding-linux-*`, `@css-inline/*` — 총 57곳, 버전 자체는 불변)
  - 위치: `pnpm-lock.yaml` (예: `lightningcss-linux-arm64-gnu@1.33.0` 블록, diff 상 `@@ -7623,56 +7456,48 @@ packages:` 부근)
  - 상세: override 변경으로 인한 재해소(`pnpm install`)가 이 native-binary 패키지들의 `libc:` 선언까지 지우는 부수효과를 냈다. 다만 이 패키지들은 이름 자체에 `-gnu`/`-musl` 이 인코딩돼 있어(예: `lightningcss-linux-x64-musl`) pnpm 의 실제 optional-dependency 선택은 패키지명으로 이뤄지고, `libc:` 필드는 부가 검증 정보에 가깝다. `cpu:`/`os:` 필드는 그대로 남아 있어 기능적 회귀 가능성은 낮다고 판단했으나, PR 설명이 "25건 audit 대상"으로만 스코프를 좁혀 이 981줄 diff 중 실제 보안 대상 변경은 일부이고 나머지는 override 재해소의 drive-by 잡음이라는 점은 리뷰어가 대조하지 않으면 놓치기 쉽다.
  - 제안: 조치 불요(기능 영향 없음으로 판단). 다만 PR 본문/CHANGELOG 가 "lockfile 변경에는 중복 제거가 함께 실렸다"고 이미 명시했으므로 충분하다 — 추가 언급은 다음 리뷰어를 위한 근거 기록 목적.

- **[INFO]** `codebase/frontend/package.json` 의 `@next/mdx`(`^16.2.12`)가 같은 PR 에서 함께 `^16.3.3` 대에 맞춰 상향되지 않았다
  - 위치: `codebase/frontend/package.json:23`
  - 상세: 이번 PR 은 `next` 코어를 `^16.2.12 → ^16.3.3`(frontend·channel-web-chat 양쪽)로 올렸지만, 1st-party companion 패키지인 `@next/mdx` 는 이 diff 에서 건드리지 않았다. 알려진 CVE 대상도 아니고 `check-unmet-peers.py` 도 새 peer 충돌 0건을 보고해 당장 깨지는 것은 없지만, 1st-party next 생태계 패키지는 코어와 버전을 맞춰 가는 것이 일반적 관례라 다음 audit 라운드에서 드리프트가 누적될 수 있다.
  - 제안: 이번 PR 의 스코프(보안 audit 수렴)를 벗어나므로 블로킹 사유는 아님. 후속 정기 업데이트 시 함께 상향 검토.

## 요약

이 PR 은 새 외부 패키지를 도입하지 않았다 — 전부 기존(직접·전이) 의존성의 버전 상향이며, 신설된 `qs` override 도 이미 트리에 존재하던 전이 패키지(`qs@6.15.2`)를 관리 대상으로 편입한 것이지 새 패키지 추가가 아니다. 라이선스 관점에서 우려할 신규 패키지가 없다(모두 기존에 이미 승인된 패키지의 patch/minor 버전업). 버전 고정 정책(`PROJECT.md §버전 핀 정책`)을 정확히 준수한다 — 직접 의존은 caret 유지, 전이 의존 강제는 `pnpm-workspace.yaml` overrides, 2-place 편집(`EXPECTED_OVERRIDES` 동반 갱신) 규약도 지켰다. `js-yaml` 두 건은 override 스코프 키의 상한까지 함께 올려 "값만 올리고 키를 안 올리면 override 가 무력화된다"는 이 저장소의 기존 함정(#1038)을 재발 없이 피했다. 취약점 관점은 이 PR 의 핵심 목적 그 자체이며, 실측(`pnpm audit` exit 0, 세 개의 커스텀 가드 스크립트 전부 exit 0)으로 25건 → 0건 수렴을 직접 재현·확인했다. 불필요한 의존성 추가는 없고, 981줄에 달하는 lockfile diff 의 대부분은 override 재해소에 따른 중복 제거·전수 대조 결과 다운그레이드 0건(스크립트 재확인 완료)이라 번들 크기·빌드 시간에 실질적 악영향은 없을 것으로 판단된다(TEST WORKFLOW build 187s PASS 로 이미 실측됨). 기존 의존성과의 호환성도 unmet-peers 가드가 새 충돌 0건을 보고했고, `qs` override 가 `express`/`superagent` 부모 선언 범위를 깨지 않음을 `npm view` 로 사전 확인한 흔적이 pnpm-workspace.yaml 주석에 남아 있다. 내부(workspace) 패키지(`@workflow/*`)는 이번 diff 의 영향권 밖이다. 두 건의 INFO 는 모두 비차단성 관찰이다.

## 위험도

NONE
