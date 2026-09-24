# 정식 규약 준수 검토 — `spec/conventions/**`

## 검토 범위 및 방법

target 이 `spec/conventions` 자체이므로 본 검토는 **자기 참조적**이다 — `spec/conventions/**` 문서들이 CLAUDE.md·SKILL.md 가 정한 문서 구조·명명 컨벤션을 스스로 지키는지, 그리고 `spec-impl-evidence.md` 가 정의한 frontmatter 스키마를 다른 conventions 문서들이 준수하는지를 본다.

prompt_file 에 조립된 bundle 은 `cafe24-api-metadata.md`·`chat-channel-adapter.md`·`swagger.md`·`error-codes.md`·`node-output.md`·`secret-store.md` 등 다수 파일이 "컨텍스트 예산 초과로 본문 생략" 처리돼 있었다(기존에 알려진 `--spec` 예산 문제와 동일 증상). 이 결손을 메우기 위해 worktree 내 `spec/conventions/**` 실제 파일을 `Read`/`grep`으로 직접 읽어 검토했다 — 아래 발견사항은 생략되지 않은 원문 기준이다.

frontmatter 스키마(id/status/code/pending_plans) 전수 점검, `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES`/`EXCLUDE_BASENAMES`/`CATALOG_FIELD_FILE` 실코드 대조, `PROJECT.md` 자동 가드 표 대조, cafe24/makeshop 카탈로그 220여 개 field-level 파일의 파일명 패턴까지 확인했다.

## 발견사항

### [WARNING] cafe24 카탈로그 field-level 파일명의 `__` 계층 구분자가 §7.1 명명 규약에 미문서화

- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 "파일 1개 = entity 1개"
- 위반 규약: 동일 문서 §7.1 자신 — "`<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (**kebab-case** — docs anchor 식별자와 동일 형식, 예: `appstore-orders`)"
- 상세: 실제 `cafe24-api-catalog/<resource>/<entity>.md` 222개 중 **67개(약 30%)** 가 `boards__articles__comments.md`·`categories__decorationimages.md`·`customers__paymentinformation.md` 처럼 **이중 밑줄(`__`)** 을 계층 구분자로 쓴다. §7.1 이 제시하는 예시(`appstore-orders`)는 단일 하이픈 kebab-case 뿐이라, 이 이중 밑줄 표기법이 규칙에서 언급되지 않는다. `_generator.py` 를 보면 파일명은 Cafe24 문서가 부여한 entity id 를 그대로 쓰므로(코드상 결함은 아님) 실제 파일 생성 로직 자체는 건전하지만, **문서가 자신이 만드는 산출물의 형태를 정확히 기술하지 못하고 있다** — "kebab-case" 라는 문구만 읽은 사람은 `__` 표기를 규칙 위반으로 오인하거나, 반대로 신규 entity 를 손으로 추가할 때 계층 구분 없이 단일 하이픈으로 이어 붙여 하위 resource 존재를 감추는 이름을 만들 위험이 있다.
- 제안: §7.1 에 "sub-resource 가 상위 entity 아래 중첩된 경우(Cafe24 문서 자체가 `<parent>__<child>` 형태로 식별자를 부여하는 경우) 이중 밑줄로 계층을 표기한다" 는 문장과 실제 사례(`boards__articles`, `categories__seo` 등)를 추가해 규칙과 산출물을 일치시킨다.

### [INFO] `node-output.md` 가 3섹션 권장 구조 중 `## Rationale` 이 없음

- target 위치: `spec/conventions/node-output.md` (554줄, `status: partial`)
- 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" — Overview/본문/Rationale. (권장 사항이라 CRITICAL/WARNING 은 아님)
- 상세: 이 문서는 다른 대다수 conventions 문서(`audit-actions.md`·`error-codes.md`·`redis-keys.md`·`swagger.md` 등)와 달리 `## Overview`, `## Rationale` 헤딩이 모두 없다. Principle 0~11 각각이 결정 배경을 본문에 산문으로 섞어 서술하는 방식이라 실질적으로 근거가 유실된 것은 아니지만, `swagger.md`·`error-codes.md` 등 다른 문서가 이 파일의 특정 절을 "SoT" 로 인용하면서도 "§Rationale" 형태로는 인용하지 않는 것으로 보아, 이 문서만 구조가 다르다는 점이 눈에 띈다. 12개 conventions 파일이 `## Overview` 헤딩 없이 시작하며(그 중 다수는 `## Rationale`은 보유), 이는 대세와 다른 소수 패턴이다.
- 제안: 강제 사항은 아니므로 수정 의무는 없음. 다음 개정 시 `## Rationale` 절을 신설해 Principle 전반의 설계 결정을 모아두면 다른 conventions 문서와의 구조 일관성이 좋아진다.

### [INFO] `## Rationale` 헤딩 표기가 문서마다 갈린다 (번호 유무)

- target 위치: `spec/conventions/*.md` 전반
- 위반 규약: 정식 규약은 아니고 SKILL.md 의 "권장" 구조 — 위반이라기보다 표기 비일관성
- 상세: `audit-actions.md`·`error-codes.md`·`redis-keys.md`·`swagger.md`·`spec-impl-evidence.md`·`user-guide-evidence.md`·`review-citations.md`·`cafe24-restricted-scopes.md`·`egress-masking.md`·`execution-context.md`·`frontend-layering.md`·`rag-evaluation.md`·`raw-query-results.md` 등은 정확히 `## Rationale` 을 쓰는 반면, `conversation-thread.md`(`## 8. Rationale`)·`data-hydration-surfaces.md`(`## 4. Rationale`)·`interaction-type-registry.md`(`## 5. Rationale`)·`migrations.md`(`## 7. 폐기 대안 (Rationale)`)는 번호를 붙이거나 다른 제목을 쓴다. 이 자체가 실제 링크 깨짐을 만들지는 않았다(저장소 전체 grep 으로 `#rationale` bare anchor 참조가 이 4개 파일을 향하는 사례는 발견되지 않음 — `spec-link-integrity.test.ts` 위반은 아님), 다만 앵커 slug 가 `#8-rationale`처럼 문서마다 달라져 향후 다른 문서가 관례적으로 `#rationale` 로 인용하면 깨질 잠재 위험이 있다.
- 제안: 강제하지 않되, 다음 개정 때 헤딩을 `## Rationale`(본문 번호 체계 밖)로 통일하면 문서 간 인용 패턴이 예측 가능해진다.

### [INFO] `makeshop-api-catalog` 의 전역 `makeshop-` id prefix 가 §2.1 예외 문구보다 넓게 적용됨

- target 위치: `spec/conventions/makeshop-api-catalog/*.md` (`benefit.md`→`id: makeshop-benefit` 등 7개 전부)
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의 표 — "같은 basename 이 영역을 달리해 중복될 때는 **후발 문서가** 영역 prefix 로 충돌을 회피한다"
- 상세: 실제로 `order.md`/`product.md` 는 `cafe24-api-catalog/`(`id: order`, `id: product`)와 파일명이 겹쳐 prefix 가 필요하지만, `benefit.md`/`board.md`/`cpik.md`/`member.md`/`shop.md` 는 cafe24 카탈로그에 동명 파일이 없어 §2.1 문구가 말하는 "충돌 시" 조건에 해당하지 않는데도 동일하게 `makeshop-` prefix 를 받았다. 이는 위반이라기보다 §2.1 이 명시한 "충돌 트리거" 규칙보다 실제로는 "카탈로그 그룹 전체를 일괄 prefix" 하는 더 넓은(그리고 합리적인) 관행이 적용된 것이다.
- 제안: §2.1 각주에 "카탈로그처럼 여러 resource 를 묶어 다루는 디렉토리는 충돌 여부와 무관하게 그룹 전체에 동일 prefix 를 미리 적용해도 된다" 는 문장을 추가해 실제 관행을 규약 문구에 반영한다 (규약을 실제에 맞게 갱신하는 편이 자연스럽다).

## 확인했으나 위반이 아닌 것 (기록용)

- `spec/conventions/*.md` 전 25개 top-level 파일의 `id`(kebab-case) 가 basename 과 일치 — mismatch 0.
- `status: partial` 인 `chat-channel-adapter.md`·`node-cancellation.md`·`node-output.md` 모두 `pending_plans:` 를 선언했고, 그 경로 6개 전부 `plan/in-progress/**` 에 실존.
- `cafe24-api-catalog/_overview.md`·`makeshop-api-catalog/_overview.md` 는 밑줄 prefix 로 frontmatter 의무에서 정상 제외.
- field-level 카탈로그 파일(`resource`/`entity`/`cafe24_docs`/`source`)은 `id`/`status` 를 갖지 않아 §Rationale R-7 예외와 일치.
- `review-citations.md` 의 `code:` 는 "준수 예시 / 시행 코드 / 대조군" 을 인라인 YAML 주석으로 축 분리 — §2.1 이 허용한 패턴과 정확히 일치.
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES`/`EXCLUDE_BASENAMES`/`CATALOG_FIELD_FILE` 실제 코드가 `spec-impl-evidence.md §1` 서술과 1:1 일치.
- `PROJECT.md` "자동 가드(build-time 차단)" 표는 doc-sync/frontmatter 계열 가드만 다루는 절로 스코프가 한정돼 있어, `swagger.md`/`cafe24-api-catalog` 가 언급하는 backend repo-guard(`dto-class-name-collision`·`catalog-sync` 등)가 그 표에 없는 것은 누락이 아니라 스코프 밖.
- `swagger.md`(DTO/Controller 명명·`@ApiProperty` 패턴·`writeOnly`/`readOnly`·`Update` 접두 범위 등)는 자체적으로 매우 정밀하게 범위를 한정하고 근거를 남기고 있어 API 문서 규약 위반 없음.
- `error-codes.md`(UPPER_SNAKE_CASE 명명·rename 안정성·historical-artifact 레지스트리)와 `redis-keys.md`(키 형태·SoT 분리) 모두 출력 포맷/명명 규약과 정합.

## 요약

`spec/conventions/**` 은 전반적으로 정식 규약을 스스로 잘 지키고 있다. frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 준수, 가드 코드와의 1:1 대조, 카탈로그 예외 규칙 적용까지 표본 검사에서 CRITICAL 급 위반은 발견되지 않았다. 발견된 항목은 모두 "문서가 자신이 실제로 만든 산출물의 형태를 정확히 기술하지 못한" 종류의 소소한 문서-현실 간극(WARNING 1건: cafe24 카탈로그 파일명의 `__` 계층 구분자 미문서화)과, 3섹션 구조·헤딩 표기 일관성에 관한 INFO 3건이다. 다만 prompt_file 번들 자체가 예산 초과로 다수 핵심 문서(swagger/error-codes/node-output/secret-store 등)를 생략한 채 조립됐다는 점은 이 checker 실행과 무관하게 harness 차원에서 재확인이 필요하다 — 이번 검토는 원본 파일을 직접 읽어 보완했지만, 다른 세션이 번들만 보고 판단하면 거짓 음성(false negative)을 낼 수 있다.

## 위험도

LOW
