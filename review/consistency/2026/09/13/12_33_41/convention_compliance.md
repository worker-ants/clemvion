# 정식 규약 준수 검토 — `spec/conventions/`

## 검토 범위 안내

Target 번들(`_prompts/convention_compliance.md`)은 컨텍스트 예산 초과로 대다수 파일이
"본문 생략됨(의도된 절단)"으로 표시되어 있었다. 전문이 번들에 남아있던 파일은
`audit-actions.md`, `cafe24-api-catalog/_overview.md`, `cafe24-api-catalog/category.md`,
`cafe24-api-catalog/store.md`, `cafe24-api-catalog/translation.md`, `cafe24-api-metadata.md`
6개뿐이었다. 이 리뷰는 그 6개 파일은 번들 텍스트로, 그 외 전체(`spec/conventions/**` 실제
25개 최상위 파일 + 2개 카탈로그 `_overview.md` + 다수 field-level 파일)는 **워크트리 파일시스템을
직접 읽어** 프론트매터·구조·상호 참조를 교차검증했다. 생략된 파일들의 본문 내부 규약 위반은
번들만으로는 검증 불가능하므로 이 리포트의 커버리지 한계로 명시한다(§요약 참고).

## 발견사항

- **[WARNING] cafe24-api-metadata.md 가 "노드 출력 envelope" 를 잘못된 Principle 번호로 인용**
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §4 "Wire-format 규약" 말미의
    "**용어 주의**" 박스 — `"CONVENTIONS Principle 7 의 **노드 출력 envelope**
    (\`{config, output, meta, port}\`) 와 무관한 별개 개념이다."`
  - 위반 규약: `spec/conventions/node-output.md` — 5필드 envelope(`{ config, output, meta?,
    port?, status? }`)의 정의는 **Principle 0**(`## Principle 0 — NodeHandlerOutput의 5필드는
    불변`)이 소유한다. **Principle 7**은 `## Principle 7 — config echo 원칙
    (NodeHandlerOutput.config)`으로, `config` 필드 하나의 echo 규칙만 다루며 envelope 전체
    구조를 정의하지 않는다.
  - 상세: `git log -S`로 확인한 결과 node-output.md는 2026-04-19 커밋 시점부터 이미 Principle
    0=5필드 정의, Principle 7=config echo 로 번호가 고정돼 있었고, cafe24-api-metadata.md의
    해당 문구가 작성된 2026-05-16 커밋(`baa1fc13f`) 시점에도 이미 이 번호였다 — 이후
    재넘버링으로 어긋난 것이 아니라 **작성 시점부터 잘못 인용**됐다. 추가로 인용된 필드 목록
    `{config, output, meta, port}`도 Principle 0의 실제 5필드(`status` 포함)에서 `status`가
    빠져 있다. 이 참조는 마크다운 링크(`[...](...)`)가 아닌 평문 텍스트라 `spec-link-integrity.test.ts`
    같은 자동 가드가 경로/앵커 존재만 검사하고 "번호가 가리키는 절의 내용이 맞는가"는 검사하지
    않는다 — 즉 사람이 아니면 못 잡는 자리다.
  - 제안: `Principle 7` → `Principle 0`으로 정정하고, 인용 필드 목록에 `status`를 추가
    (`{config, output, meta, port, status}` 또는 원문처럼 `?`로 optional 표기 유지)한다. 이
    수정은 개념적 오류 정정이므로 `developer`가 자기 문서를 고치는 자기-반증형 소정정 요건과는
    무관하며(예고 문장이 아니라 이미 확정된 §4가 대상), 통상적인 `project-planner` 경로로
    처리하는 편이 안전하다.

- **[INFO] cafe24 API 카탈로그 top-level 파일 간 `## Rationale` 섹션 유무가 들쭉날쭉**
  - target 위치: `spec/conventions/cafe24-api-catalog/*.md` (18개 resource 인덱스 파일)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" —
    Overview/본문/Rationale 3섹션 권장.
  - 상세: `store.md`·`mileage.md`·`notification.md`·`privacy.md`는 `## Rationale`을 갖고
    있으나 `category.md`·`translation.md`·`application.md`·`order.md`·`product.md` 등
    나머지 13개는 없다. `spec-impl-evidence.md §4.2`가 `spec/conventions/`를
    "flat reference, 무-index"로 명시적으로 다르게 취급하고 있어 이 자체가 규약 위반은 아니지만
    (Rationale은 "기록할 결정이 있을 때"만 채우는 것이 합리적), 같은 디렉토리·같은 frontmatter
    스키마를 공유하는 sibling 파일 사이의 구조 비대칭이라 새로 파일을 추가하는 사람이 어느 쪽이
    "정상"인지 헷갈릴 여지가 있다. CRITICAL/WARNING으로 볼 만한 내용 위반은 아니라 INFO로
    낮춘다.
  - 제안: 규약 갱신은 불필요 — 대신 `_overview.md` §2(컬럼 정의) 나 §Rationale 어딘가에
    "resource 인덱스는 실제 결정이 있을 때만 `## Rationale`을 붙인다"는 한 줄을 명시하면
    다음 작성자의 판단 기준이 명확해진다.

- **[INFO] 검토 커버리지 한계 — 번들 절단으로 미검증된 파일**
  - target 위치: 번들 전체 — `chat-channel-adapter.md`, `conversation-thread.md`,
    `egress-masking.md`, `error-codes.md`, `interaction-type-registry.md`, `migrations.md`,
    `node-cancellation.md`, `node-output.md`, `rag-evaluation.md`, `redis-keys.md`,
    `review-citations.md`, `secret-store.md`, `spec-impl-evidence.md`, `swagger.md`,
    `user-guide-evidence.md`, `makeshop-api-catalog/**`, `cafe24-restricted-scopes.md`,
    `cross-node-warning-rules.md`, `data-hydration-surfaces.md`, `execution-context.md`,
    `frontend-layering.md`, `i18n-userguide.md`, `raw-query-results.md` 및 카탈로그
    field-level 파일 다수.
  - 위반 규약: 해당 없음 (프로세스 한계 기록).
  - 상세: 파일시스템에서 직접 읽어 **frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)와
    `id`-basename 일치, `status: partial`의 `pending_plans` 경로 실존, `code:` 경로 실존**은
    전수 확인했고 전부 통과했다(불일치 0건, 누락 0건). 다만 본문 산문 수준의 명명·출력 포맷
    규약 위반은 이 6개 파일 밖에서는 검증하지 못했다.
  - 제안: 다음 라운드에서 이 리스트의 파일들을 별도 청크로 나눠 재검토하거나, orchestrator가
    번들 예산을 넉넉히 잡아 재실행할 것을 권장.

## 요약

번들에 전문이 남아있던 6개 파일(`audit-actions.md`, `cafe24-api-catalog/_overview.md`,
`category.md`, `store.md`, `translation.md`, `cafe24-api-metadata.md`)과 파일시스템에서 직접
확인한 `spec/conventions/` 전체 25개 최상위 파일의 frontmatter·명명·plan 참조 무결성은 대체로
정식 규약을 잘 지키고 있다 — `id`/`status`/`code`/`pending_plans` 스키마 위반 0건, 파일명-`id`
불일치 0건, `code:`/`pending_plans:` 참조 경로 실존 확인 완료, `_overview.md` 두 파일의
frontmatter 부재는 `spec-impl-evidence.md §1`의 밑줄-prefix 예외 규정과 정확히 일치해
위반이 아니다. 유일하게 확인된 실질적 결함은 `cafe24-api-metadata.md`가 노드 출력 envelope의
정의처를 `node-output.md`의 잘못된 Principle 번호(7이 아니라 0)로 인용하고 있고 필드 목록도
`status`가 누락된 채라는 점이며, 이는 링크 무결성 가드가 잡지 못하는 평문 인용이라 사람이 짚어야
한다. 다만 번들 자체가 컨텍스트 예산으로 대부분 파일을 절단해 제공했기 때문에, 이 리포트가 본
파일들 밖의 규약 위반까지 포괄한다고 보증할 수는 없다.

## 위험도

LOW
