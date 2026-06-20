# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] eslint.config.mjs 인라인 주석 밀도 적정 — 다만 단일 규칙에 6줄 블록 주석은 과잉
- 위치: `/Volumes/project/private/clemvion/codebase/backend/eslint.config.mjs` lines 183–188 (diff +4~+10)
- 상세: `no-unnecessary-type-assertion` 추가 이유를 설명하는 인라인 주석이 6줄로, 단일 ESLint 규칙 하나에 붙는 설명으로는 비대하다. 이유(281건 누적 경위, `--fix` cascade 버그)는 유용한 맥락이나, 동일 맥락이 README/RESOLUTION 양쪽에도 존재해 중복 산문이다. ESLint 설정 파일은 규칙 의도를 1–2줄로 요약하고 상세 배경은 PR/RESOLUTION 링크로 위임하는 패턴이 더 가독성이 높다.
- 제안: 주석을 "redundant `as T` 281건 누적; `--fix` cascade 버그로 error 불가 → warn 으로 가시화. 정리: `pnpm --filter backend lint:fix`" 수준으로 압축.

### [INFO] plan-frontmatter.test.ts — `path.sep` 기반 경로 검증 문자열이 플랫폼 의존
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` lines 405–408
- 상세: `` p.includes(`${path.sep}plan${path.sep}in-progress${path.sep}`) `` 는 Unix 환경에서 정상 동작하나 Windows(`\`) 와 Unix(`/`) 를 혼용하는 개발자 환경에서 잠재적 오탐 가능성이 있다. `collectTopLevelPlans`가 `path.join`으로 경로를 생성하므로 실제 플랫폼과 일치하여 문제가 발생할 가능성은 낮지만, `path.join(root, "plan", "in-progress")` 결과로 prefix 검증하는 방식이 더 명시적이다.
- 제안: `` p.startsWith(path.join(root, "plan", "in-progress")) `` 로 대체하면 separator 관련 가정을 제거하고 의도를 더 명확히 표현할 수 있다.

### [INFO] plan/complete/exec-single-node.md — spec_impact 섹션 참조 정보 손실
- 위치: `/Volumes/project/private/clemvion/plan/complete/exec-single-node.md` frontmatter
- 상세: 변경 전 `spec_impact` 에 `§1.3·§9·R`, `§15(C3)`, `§2.13` 등 세부 섹션 참조가 포함되었으나 리스트 형식으로 교체하면서 파일 경로만 남고 섹션 레벨 정보가 제거되었다. 완료된 plan 의 맥락 추적 목적으로 섹션 참조는 유용한 정보다.
- 제안: YAML 리스트 형식을 유지하면서 섹션 참조를 주석이나 별도 필드(`spec_impact_detail`)로 보존하거나, 본문 내 관련 섹션 기재를 유지한다. 단, RESOLUTION에서 "코드 유지"로 수렴됐으므로 이는 참고 수준.

### [INFO] README.md — npm 명령어와 pnpm 전환 불일치로 문서 일관성 훼손
- 위치: `/Volumes/project/private/clemvion/codebase/backend/README.md` lines 7–9, 스크립트 표 전반
- 상세: 이번 diff는 `lint`/`lint:fix` 행만 갱신했으나, `npm install`, `npm run start:dev` 등 실행 섹션과 스크립트 표의 다른 행은 여전히 `npm run` 접두어를 사용한다. pnpm workspace 전환(PR #646) 이후 README가 일관되지 않은 상태다. 신규 개발자가 README를 보고 `npm install`을 실행하면 pnpm workspace 환경에서 오동작할 수 있다.
- 제안: 이번 PR에서 함께 `npm` → `pnpm` 전수 교체 권장. 최소한 실행 섹션의 `npm install` / `npm run start:dev` 는 교체가 필요하다. (RESOLUTION에서 별도 이슈로 분류했으나 문서 일관성 관점에서 재언급.)

### [INFO] eslint.config.mjs test override 블록 — 동일 패턴의 규칙 off 처리가 분산
- 위치: `/Volumes/project/private/clemvion/codebase/backend/eslint.config.mjs` lines 205–218
- 상세: test override 블록에서 `no-unsafe-*` 6종을 `off` 처리하는 패턴은 이미 존재하며, `no-unnecessary-type-assertion: off` 가 추가되는 방식은 기존 패턴과 일관된다. 일관성 자체는 문제없으나, test 환경에서 off 하는 규칙 목록이 늘어날수록 "테스트 파일에서 허용되는 것"의 명시적 기록으로서 의미가 있으므로 그룹 주석("테스트 더블 환경에서 타입 안전성 규칙 일괄 완화")을 섹션 단위로 상단에 한 줄 두는 것이 가독성을 높인다.
- 제안: test override 블록 상단에 한 줄 섹션 주석 추가 (`// 테스트 더블·방어적 캐스트 환경 — unsafe/assertion 규칙 완화`).

## 요약

이번 변경은 backend lint 게이트를 report-only로 전환하고 문서·테스트를 보완하는 소범위 변경이다. 유지보수성 관점에서 심각한 문제는 없으며 전반적으로 적절하게 구성되었다. 주요 개선 기회는 세 가지다: (1) eslint.config.mjs의 인라인 주석 밀도가 높아 동일 내용이 RESOLUTION과 중복되므로 압축이 바람직하다; (2) README의 npm/pnpm 불일치가 문서 신뢰성을 훼손하며 이번 기회에 전수 교체가 권장된다; (3) plan-frontmatter 테스트의 경로 검증은 prefix 기반으로 표현하면 의도가 더 명확해진다. 기존 코드베이스 스타일 및 패턴 준수는 양호하다.

## 위험도

LOW
