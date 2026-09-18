# 정식 규약 준수 검토 — `spec/conventions/**` (--impl-prep, FK 인덱스 V121~V130 착수 전)

## 범위·방법 메모

- 검토 모드: `--impl-prep`, scope=`spec/conventions/`. 이 브랜치(`fk-index-remaining-cd2eec`)의 유일한 신규 커밋(`4dfc5787b`)은 `spec/1-data-model.md`·`spec/data-flow/**`만 건드리고 `spec/conventions/**` 자체는 변경하지 않았다 — 즉 본 검토는 "이번 diff가 conventions를 어겼는가"가 아니라 "지금 conventions가 뒤이을 구현(V121~V130 FK 인덱스 마이그레이션, `plan/in-progress/spec-draft-fk-remaining-dispositions.md`)을 지지할 만큼 자기 정합적인가"를 확인하는 baseline 점검이다.
- 조립된 `_prompts/convention_compliance.md` 번들은 `cafe24-api-metadata.md` 이후 대부분 "본문 생략됨 — 컨텍스트 예산 초과"로 절단되어 있었다(약 20개 파일). 번들만으로는 `error-codes.md`·`redis-keys.md`·`swagger.md`·`spec-impl-evidence.md`·`node-output.md` 등 핵심 conventions를 검증할 수 없어, worktree 파일시스템에서 `spec/conventions/*.md` 전체를 직접 Read/grep 하여 보완했다. (기존에 알려진 harness 한계 — 대규모 conventions 디렉토리를 한 프롬프트에 번들링하면 예산을 초과한다.)

---

## 발견사항

- **[WARNING] `migrations.md`의 Rationale 섹션이 corpus 전역 관례에서 벗어남**
  - target 위치: `spec/conventions/migrations.md` §7 (`## 7. 폐기 대안 (Rationale)`, line 155) 및 그 뒤의 `## 참고` (line 198)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "명명 컨벤션" 표의 `## Rationale` (결정 배경·근거·폐기된 대안) — CLAUDE.md가 위임한 3섹션(Overview/본문/Rationale) 구성
  - 상세: `spec/conventions/*.md` 23개 최상위 문서 중 Rationale에 해당하는 절이 있는 22개는 전부 bare `## Rationale` 헤딩을 쓰고 그 헤딩이 문서의 **종결 섹션**이다(`grep -n '^## Rationale'` 뒤에 다른 `## ` 헤딩이 오는 파일은 0건, 직접 확인). `migrations.md`만 유일하게 "Rationale"을 번호 붙은 절 제목의 괄호 표기(`## 7. 폐기 대안 (Rationale)`)로 넣고, 그 뒤에 `## 참고`(레퍼런스) 섹션을 추가로 이어 붙여 Rationale이 종결 섹션이 아니다. 내용 자체(대안 1~4 폐기 근거)는 Rationale의 기능을 정확히 수행하므로 CRITICAL은 아니나, "Rationale = 마지막 섹션"을 전제로 순회하는 도구·사람이 이 문서만 놓칠 수 있다.
  - 제안: 헤딩을 `## Rationale`(bare)로 바꾸고 "폐기 대안"은 하위 `###`로 두거나, `## 참고`를 Rationale 앞으로 옮긴다. 의도된 예외라면 project-planner SKILL.md에 "레퍼런스 섹션은 Rationale 뒤에 올 수 있다"는 예외를 명시한다.

- **[WARNING] 다수 conventions 문서가 `## Overview` 섹션을 생략**
  - target 위치: `spec/conventions/{chat-channel-adapter,conversation-thread,cross-node-warning-rules,data-hydration-surfaces,i18n-userguide,interaction-type-registry,cafe24-api-metadata,makeshop-api-metadata,node-cancellation,node-output,secret-store,swagger}.md` (최상위 23개 문서 중 13개, 과반)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md`의 3섹션 구성 표 — `## Overview (제품 정의)`
  - 상세: 위 문서들은 frontmatter 직후 바로 `## 1. …`/`## Principle 0` 등 본문으로 진입하고 별도 Overview 섹션이 없다(`execution-context.md`는 `## Overview (목적)`로 준수, 대조군). 이 중 `node-output.md`는 Rationale 섹션도 전혀 없어(`grep '^## Rationale' node-output.md` 0건) 3섹션 중 2개가 빠져 있다 — Principle 0~11 안에 "왜" 절이 별도로도 존재하지 않는다(전부 규칙 서술).
  - 제안: 신규 conventions 작성 시 최소 Overview 1단락(목적·적용 범위 요약)을 의무화하고, 기존 문서는 기회가 될 때(다음 편집) 점진 보강. 자동 가드가 없으므로 CRITICAL로 볼 근거는 없고, 이번 FK 인덱스 작업과도 무관한 기존 상태다.

- **[INFO] `migrations.md`의 §1 가드 정규식 서술 — 실측 재확인 (변경 불필요, 참고용)**
  - target 위치: `spec/conventions/migrations.md` §1 (line 62)
  - 상세: "`migrations.spec.ts`의 `SQL_NAME_RE`는 하이픈까지 허용(`[a-z0-9_-]+`), `check-migration-versions.py`의 `SQL_RE`는 대문자까지 허용(`[A-Za-z0-9_]+`)"이라는 서술을 실제 코드(`codebase/backend/src/migrations.spec.ts:25`, `scripts/check-migration-versions.py:40`)와 대조해 **정확히 일치**함을 확인했다. 위반 아님 — 문서-코드 drift가 없다는 긍정 확인.

- **[INFO] `cafe24-api-catalog/_overview.md`의 frontmatter 부재는 위반 아님 (오탐 방지 확인)**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md`
  - 상세: 같은 디렉토리의 `category.md`·`store.md`·`translation.md` 등은 `id`/`status`/`code` frontmatter를 갖는데 `_overview.md`만 없어 처음엔 불일치로 보였다. 그러나 `spec-impl-evidence.md §1` "제외" 목록이 `spec/_*.md` 및 `spec/<영역>/_*.md`(밑줄 prefix, 예시로 `_overview.md`를 명시)를 frontmatter 의무에서 명시적으로 면제한다 — 정상 상태다.

---

## FK 인덱스 마이그레이션(V121~V130) 착수 관점 확인

- 현재 `codebase/backend/migrations/` 최대 버전은 `V120`이며 gap 없이 단조 증가 — `migrations.md` §2(단조 증가·gap 금지)와 일치하고 다음 번호 `V121`부터 이어 붙이는 계획과 충돌 없음.
- 선행 인덱스 마이그레이션(V111~V120)을 직접 열람해 확인한 결과: `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + 동봉 `.conf`(`executeInTransaction=false`) 패턴이 `migrations.md` §5의 인용문("`README.md` §5, `CREATE` 앞에 invalid 잔재 정리")과 정확히 일치하며, `plan/in-progress/spec-draft-fk-remaining-dispositions.md`가 V121~V130에 대해 선언한 구현 방식도 동일 패턴을 명시한다 — conventions와 계획 사이에 모순 없음.
- 결론: `migrations.md` 자체에는 이번 구현을 막을 CRITICAL 요소가 없다. impl-prep 관점에서 이 게이트는 통과 가능하다.

---

## 요약

`spec/conventions/`는 이번 브랜치에서 수정되지 않았고, 검토 대상은 뒤이을 FK 인덱스 마이그레이션(V121~V130) 구현이 딛고 설 baseline이다. 실제 구현과 직결되는 `migrations.md`는 명명 규약·V번호 정책·CONCURRENTLY 인덱스 패턴이 코드(가드 정규식, V111~V120 선례)와 정확히 일치해 CRITICAL 결함이 없으며, impl-prep 게이트를 막을 사유가 없다. 다만 conventions 코퍼스 전반에는 CLAUDE.md/project-planner SKILL.md가 권고하는 "Overview/본문/Rationale 3섹션" 구성을 완전히 따르지 않는 문서가 절반 가량 있고(`node-output.md`는 Rationale 섹션 자체가 없음), `migrations.md`의 Rationale 헤딩 표기·위치도 corpus 관례에서 유일하게 벗어나 있다 — 둘 다 자동 가드가 없는 권고 사항이고 이번 작업과 무관한 기존 상태라 WARNING 수준으로 남긴다. `cafe24-api-catalog/_overview.md`의 frontmatter 부재는 `spec-impl-evidence.md`의 명시적 면제 대상임을 확인해 오탐이 아님을 배제했다.

## 위험도

LOW
