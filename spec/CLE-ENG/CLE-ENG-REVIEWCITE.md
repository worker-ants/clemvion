---
id: "CLE-ENG-REVIEWCITE"
title: "리뷰 산출물 인용 규약"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ENG"
ancestors: ["CLE-VISION", "CLE-ENG"]
area: "CLE-ENG"
content_hash: "b4e48803badcab0c5120a1fa8ead581b6ea96b9aaf26e7edda6e8e4d92b2f0f9"
read_as: "approved_fallback"
task: "CLE-T-M7K35H"
source_paths: ["spec/conventions/review-citations.md"]
mirror_sha256: "77f19e7f43f6d118e3565448c8f85e1da62b6fb8d66b5493a960d36f18ccbaab"
etag: "sha256-895a20db50c5837a66829ee665c22d1f31b2c3d8e9a102ff9cf3228be84c4d3d"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/review-citations.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 저장소의 코드·테스트 주석은 "왜 이 자리가 이렇게 생겼는지" 를 리뷰 산출물로 가리킨다. 이 규약은 그 관례를 문서로 정하고 리뷰 산출물 인용(review citation)의 **형식**을 정한다.

전환 단계 2(NERV Task `CLE-T-4ABTG7`) 전까지 리뷰 산출물은 리뷰 세션마다 `review/<종류>/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 디렉터리로 저장소에 커밋됐다. 이 옛 산출물은 전환 단계 3 에서 작업 트리에서 지웠다. git 이력에는 남는다. 단계 2 부터 리뷰 결과는 NERV 리뷰 레코드(라운드·발견·처분)이고 리뷰 오케스트레이터의 로컬 산출물 `.review/**` 는 커밋하지 않는다. 저장 위치는 저장소 `CLAUDE.md` 의 "정보 저장 위치" 표가 정한다.

이 문서는 두 가지 인용을 정한다. 옛 산출물 경로 인용(규칙 1~4·8)과 NERV 발견 인용(규칙 9~10)이다. 통합 검토(`kind=merge`)와 spec-coverage 감사(`kind=spec_coverage`) 결과도 전환 단계 4e(NERV Task `CLE-T-VP5KDJ`)부터 NERV 발견을 낸다. 그 전의 결과를 가리키는 방법은 규칙 9 에 있다. 리뷰가 NERV 레코드로 바뀌며 달라진 전제는 [NERV 이전 영향](#nerv-이전-영향) 에 모았다.

범위 밖:

- DTO 필드·컨트롤러의 `/** */` JSDoc 이 공개 OpenAPI 설명으로 나간다는 규칙은 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 가 정한다. 이 문서는 그 자리에 리뷰 인용을 쓰지 않는다는 점만 다룬다.
- 스펙 frontmatter `code:` 필드의 정의는 [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 이 정한다.

## 규칙

1. 코드 주석에 있는 리뷰 산출물 인용은 유지한다.
2. 옛 산출물 인용에는 **날짜를 넣는다**. 날짜 없는 시각(`hh_mm_ss`)만 쓰지 않는다. NERV 발견 인용은 규칙 9 를 따른다.
3. 옛 산출물의 권장 형식은 전체 경로(`review/code/2026/09/04/23_02_51`)다. 날짜 + 시각(`2026-09-04 23_02_51`)도 허용한다.
4. 지적 번호를 함께 적으면 더 좁혀진다. 예: `review/code/2026/09/04/23_02_51 W1`.
5. 규칙 2~4 와 9~10 은 `codebase/**` 의 코드·테스트 주석, `scripts/**`·`.github/**`, NERV 스펙 문서에 적용한다([적용 범위](#적용-범위)).
6. DTO 필드·컨트롤러의 `/** */` JSDoc 과 응답 DTO 클래스의 `/** */` JSDoc 에는 리뷰 인용을 **쓰지 않는다**. 바로 위 `//` 주석에 적고 그 `//` 주석은 규칙 2~4 나 9 를 따른다. NERV 발견 인용과 Task 키(`CLE-T-…`) 인용도 같다. DTO · 컨트롤러 파일의 `/** */` 와 데코레이터 문자열에 든 NERV 키 형태(Task 키 포함)는 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17 이 정하고 백엔드 가드 `openapi-internal-ref` 가 막는다.
7. `plan/**` 문서와 `review/**` 산출물은 이 규약의 대상이 아니다. 둘 다 전환 단계 3 에서 저장소에서 지웠다(원문은 git 이력).
8. 기존 날짜 없는 인용은 한꺼번에 바꾸지 않는다. 그 자리를 다음에 건드릴 때 함께 맞춘다.
9. 전환 단계 2 이후의 리뷰는 NERV 리뷰 발견(finding)의 **전체 ID** 로 인용한다. 형식은 `finding <발견 전체 ID>` 다(예: `finding 00000000-0000-7000-8000-000000000000`). 앞 8자처럼 줄인 ID 는 쓰지 않는다. 발견 여럿은 `finding <ID> · <ID>` 로 나열한다. ID 만으로는 NERV 에 접근하지 않고 풀 수 없으니 지적의 요지를 한 줄 함께 적기를 권한다. 전환 단계 4e 전의 통합 검토(`kind=merge`)와 spec-coverage 감사(`kind=spec_coverage`) 결과에는 발견이 없다. 그 결과를 가리킬 때는 그 결과로 올린 NERV Task 키(`CLE-T-…`)를 쓴다.
10. 리뷰 오케스트레이터의 로컬 산출물 경로(`.review/**`)는 인용하지 않는다. 커밋되지 않아 다른 체크아웃에는 없다.

규칙 9 · 10 공통: NERV 스펙 문서에서는 두 규칙이 금지한 형태를 반례로 보이는 코드 스팬과 `.review/**` 가 어디인지 설명하는 서술은 인용이 아니다. 이 문서가 담은 반례와 설명이 그 예다. `codebase/**` 에서는 가드가 줄 단위로 세어 이 면제를 두지 않는다. 반례도 쓰지 않는다. 가드 자신의 파일은 순회에서 빠지고 금지 형태를 일부러 담은 다른 가드의 대조군만 파일별 허용 목록으로 뺀다.

## 인용 형식

| 형식 | 예 | 판정 |
| --- | --- | --- |
| 전체 경로 | `review/code/2026/09/04/23_02_51` | 옛 산출물의 **권장**(규칙 3) |
| 날짜 + 시각 | `2026-09-04 23_02_51` | 허용 |
| 날짜 없는 시각 | `23_02_51` | **금지**. 날짜가 없으면 어느 리뷰 세션인지 풀 수 없다 |
| NERV 발견 전체 ID | `finding 00000000-0000-7000-8000-000000000000` | 전환 단계 2 이후 리뷰의 **권장**(규칙 9) |
| NERV Task 키 | `CLE-T-…` | 전환 단계 4e 전의 통합 검토 · spec-coverage 감사 결과를 가리킬 때만 쓴다(규칙 9) |
| 줄인 발견 ID | `finding 00000000` | **금지**. 같은 분에 생긴 발견끼리 앞부분이 겹친다 |
| 로컬 산출물 경로 | `.review/code/2026/10/01/15_33_20` | **금지**(규칙 10). 커밋되지 않는 경로다 |

리뷰 세션 시각은 날짜를 넘어 겹친다. 같은 시각이 여러 날짜에 있으면 날짜 없는 인용은 어느 세션인지 가릴 수 없다(Rationale «날짜를 넣는 근거»). NERV 발견 ID 형식의 근거는 Rationale «NERV 발견 인용 형식» 에 있다.

## 적용 범위

가르는 기준은 **그 인용이 나중에 어떤 맥락에서 읽히는가**다.

| 대상 | 적용 | 이유 |
| --- | --- | --- |
| `codebase/**` 의 코드·테스트 주석 | **적용** | 몇 달 뒤 아무 맥락 없이 읽힌다. 인용이 스스로 풀려야 한다 |
| `scripts/**` · `.github/**` | **적용** | 같은 이유다. 저장소 가드와 CI 정의도 맥락 없이 읽힌다 |
| DTO 필드 · 컨트롤러의 `/** */` JSDoc | **대상 아님**(쓰지 않음) | 그 JSDoc 은 공개 OpenAPI `description` 으로 나간다. DTO 필드는 swagger CLI 플러그인이 프로퍼티별 `description` 으로 싣는다. 리뷰 인용은 API 소비자가 읽을 문장이 아니므로 처음부터 거기에 쓰지 않는다. [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 가 정한 대로 바로 위 `//` 주석에 적는다 |
| 응답 DTO 클래스의 `/** */` JSDoc | **대상 아님**(쓰지 않음) | 필드와 똑같이 쓰지 않는다. 지금 플러그인은 클래스 JSDoc 을 스키마에 싣지 않는다(프로퍼티 메타데이터만 만든다). 그래도 응답 DTO 파일의 `/** */` 를 **공개 문서 채널 하나**로 다룬다. 피하는 자리도 같다. 바로 위 `//` 주석이다(Rationale «응답 DTO 클래스 JSDoc») |
| NERV 스펙 문서(저장소 `spec/**` 는 그 미러) | **적용** | `codebase/**` 와 같은 논리다. 살아 있는 문서라 오래 읽힌다. 기존 날짜 없는 인용이 이미 많다. 규칙 8 이 이것을 다룬다 |
| `plan/**` 문서 | 대상 아님(전환 단계 3 에서 지웠다) | 인용하던 라운드와 **같은 세션**에서 쓰였고 문서 자체가 그 맥락을 담았다. 작업 추적은 이제 NERV Task 다 |
| `review/**` 산출물 | 대상 아님(전환 단계 3 에서 지웠다) | 시점 기록이었다. 나중에 고치는 대상이 아니었고 지금은 git 이력으로만 되짚는다 |

## 강제 범위

규칙마다 강제 여부가 다르다. 규칙 6 을 한 덩어리로 "강제됨" 이라고 적지 않는다. 그 규칙은 DTO 와 컨트롤러를 함께 묶는데 가드는 절반만 본다. 묶어서 적으면 문서에 적은 보장이 구현보다 넓어진다.

| 규칙 | 강제 여부 | 근거 |
| --- | --- | --- |
| 규칙 2(날짜 없는 시각 금지), `codebase/**` 전반 | **아니오** | 가드 없음 |
| 규칙 6, **응답 DTO** JSDoc(필드·클래스)의 옛 경로 형태 인용 | **예** | 응답 DTO 가드 `dto-jsdoc-citation`(`codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`)이 AST 로 센다 |
| 규칙 6, **응답 DTO** JSDoc 의 NERV 발견 인용(`finding <ID>`) | **예** | `dto-jsdoc-citation` 이 넷째 패턴 `\bfinding\s+[0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\b` 로 센다(전환 단계 4g, 2026-10-03). 전체 ID 와 앞 8자로 줄인 ID 를 모두 잡는다. 끝을 `\b` 로 막아 앞 두 그룹으로 줄인 형태(`finding 01a10005-3522`)의 첫 8자도 잡는다 |
| 규칙 6, **컨트롤러** JSDoc | **아니오** | 규칙 6 의 금지 전체를 세는 가드는 없다. `dto-jsdoc-citation` 은 `isResponseDtoFile()` 로 `dto/responses/**` 만 훑는다. 줄인 ID 와 `.review/**` 두 형태는 `review-citation-form` 이 센다. Task 키는 `openapi-internal-ref` 가 NERV 키 형태로 센다([OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17) |
| 규칙 6, **요청 DTO** 필드 JSDoc | **아니오** | 규칙 6 의 금지 전체를 세는 가드는 없다. `dto-jsdoc-citation` 은 `dto/responses/**` 만 본다. 줄인 ID 와 `.review/**` 두 형태는 `review-citation-form` 이 센다. Task 키는 `openapi-internal-ref` 가 NERV 키 형태로 센다([OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17) |
| 규칙 9(줄인 발견 ID 금지)·규칙 10(`.review/**` 금지), `codebase/**` | **예** | `review-citation-form`(`codebase/frontend/src/lib/docs/__tests__/review-citation-form.test.ts`)이 `codebase/**` 텍스트 파일에서 두 형태가 0 인지 본다(전환 단계 4g). 읽는 파일과 잡는 형태는 아래 목록에 적는다 |
| 규칙 9 · 10, `scripts/**` · `.github/**` · NERV 스펙 문서 | **아니오** | 가드 없음(Rationale «시행 가드를 넓힌 경위») |

`review-citation-form` 이 보는 범위는 다음과 같다. 순회와 정규식은 `codebase-mentions.ts` 에 있다. 읽는 파일과 빼는 것은 `legacy-path-ratchet` · `spec-key-mentions` 와 함께 쓰는 공용 순회의 범위다. 그 목록의 기준은 [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md#빌드-가드--스펙-문서-저장소-무결성) 「빌드 가드 — 스펙 문서 저장소 무결성」의 공용 순회 문단이다. 목록을 고칠 때는 두 문서를 함께 고친다.

- 읽는 파일: `codebase/**` 아래 확장자가 `.ts` · `.tsx` · `.js` · `.mjs` · `.cjs` · `.py` · `.sh` · `.md` · `.mdx` · `.sql` · `.json` · `.yml` · `.yaml` · `.css` · `.svg` · `.html` · `.txt` · `.toml` · `.example` · `.conf` 인 파일과 `Dockerfile` 이다. 목록에 없는 확장자는 읽지 않는다.
- 빼는 것: `node_modules` · `dist` · `build` · `coverage` · `out` · `test-results` · `playwright-report` 디렉터리와 점으로 시작하는 디렉터리를 건너뛴다. 이 순회를 쓰는 가드 자신의 파일 5개도 뺀다. 판정을 시험하는 합성 입력을 담은 파일과 같은 순회를 쓰는 `legacy-path-ratchet` 가드의 기준값 파일이다.
- 규칙 9: `finding` 바로 뒤 소문자 16진 정확히 8자만 잡는다. 그 뒤에 16진 문자나 `-` 가 오면 잡지 않는다. 잡지 않는 것은 앞 두 그룹으로 줄인 형태(`finding 01a10005-3522`), 7자 · 9자, 대문자 16진, `finding <ID> · <ID>` 의 둘째 이후 ID, 줄 바꿈으로 `finding` 과 갈린 ID 다.
- 규칙 10: `.review/` 아래 `code` · `consistency` · `merge` · `spec-coverage` 네 디렉터리의 경로만 잡는다. `.review/` 아래 다른 이름은 잡지 않는다.
- 허용 목록: 줄 단위 정규식이라 인용과 반례 · 설명을 가르지 않는다. 금지 형태를 일부러 담은 다른 가드의 대조군(`dto-jsdoc-citation` 의 fixture `jsdoc-citation.fixture.ts`)은 파일별 허용 목록에 둔다. 가드는 목록이 낡지 않았는지(파일이 있고 그 형태를 여전히 담는지)도 확인한다.

두 가드의 줄인 ID 기준은 다르다. `dto-jsdoc-citation` 은 끝을 `\b` 로 막아 앞 두 그룹으로 줄인 형태의 첫 8자도 잡는다. 응답 DTO JSDoc 에는 어떤 인용도 쓰지 않으므로 넓게 잡는다. `review-citation-form` 은 전체 ID 를 통과시켜야 하므로 8자 뒤에 `-` 가 오면 잡지 않는다. 그래서 앞 두 그룹 형태는 이 가드에서 빠진다.

현재 구현의 응답 DTO 가드가 찾는 인용 형태는 네 가지다. 전체 경로(`review/{code,consistency,merge}/YYYY/MM/DD/hh_mm_ss`), 날짜 + 시각, 날짜 없는 시각, NERV 발견 인용(`finding <ID>`)이다. 날짜 없는 시각은 규칙이 금지하는 형태지만 JSDoc 에 남을 확률이 오히려 높아 가드가 함께 센다. 첫 패턴은 앞 경계가 없어 `.review/` 아래 code · consistency · merge 의 날짜 · 시각 경로도 잡는다. spec-coverage 경로는 잡지 않는다. 이 겹침은 우연이고 보장이 아니다. 규칙 10 을 지키는 가드는 `review-citation-form` 이다.

규칙 6 의 금지는 데코레이터의 `description` · `summary` 문자열에 미치지 않는다. 그 자리의 저장소 내부 참조(스펙 경로 · NERV 키 · Task 키 등)는 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17 이 정한다. 규칙 9 · 10 이 금지한 두 형태는 그 자리를 포함해 `review-citation-form` 이 codebase 전체에서 본다.

## 기존 인용

기존 날짜 없는 인용은 소급 정리 대상이 아니다. 2026-09-05 측정으로 `codebase/**` 499건, `spec/**` 36건, `scripts/**`·`.github/**` 6건이었다. 그 자리를 **다음에 건드릴 때** 함께 맞춘다. 날짜를 코드 맥락으로 하나씩 가려야 하는 일이라 기계적으로 바꿀 수 없다. [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 가 새 DTO 규칙을 들일 때 세운 것과 같은 원칙이다.

## NERV 이전 영향

규칙 1~4·8 은 리뷰 산출물이 저장소 `review/**` 에 파일로 커밋되고 세션 디렉터리 경로와 git 이력으로 인용이 풀린다는 전제 위에 있다. 전환 단계 2 부터 리뷰는 NERV 레코드이고 아래 전제가 바뀌었다. 새 리뷰의 인용 형식은 규칙 9~10 이 정한다.

| 규칙 | 단계 2 전의 전제 | 이후 바뀐 점 |
| --- | --- | --- |
| 규칙 1(인용 유지)과 그 근거 | `review/**` 가 커밋되고 정리돼도 git 이력으로 되짚을 수 있다 | NERV 리뷰는 `nerv_review_submit` 으로 레코드를 제출한다. NERV 리뷰 규약은 리뷰 산출물을 저장소에 파일로 커밋하는 것을 금지한다. 서버가 내려가 있어도 파일로 대신하지 않는다. 새 리뷰는 `review/**` 경로를 만들지 않는다 |
| 규칙 2~4(인용 형식) | 인용 대상이 리뷰 세션 디렉터리(`review/<종류>/<날짜>/<시각>`)와 그 안의 지적 번호(W1 등)다 | NERV 리뷰 발견(finding)은 레코드로 남는다. 같은 지적은 fingerprint 로 한 발견에 합쳐지고 같은 changeset·커밋으로 다시 제출하면 같은 라운드로 합쳐진다. 발견에는 스펙 버전(`spec_version_id`)·요구사항(`requirement_id`)·위치(`file`·`line`·`symbol`)가 붙는다. 코드 주석에서는 발견 전체 ID 로 가리킨다(규칙 9) |
| 적용 범위의 `review/**` 행 | 시점 기록 파일이 저장소에 쌓인다 | 새 리뷰 산출물 파일이 생기지 않는다. 전환 단계 3 에서 `review/` 를 지웠다 |
| 적용 범위의 스펙 문서 행 | 스펙 본문이 저장소 `spec/**` 에 있다 | 스펙 본문이 NERV 문서로 옮겨졌다(전환 단계 1). NERV 플러그인의 스펙 스킬은 저장소 `spec/**` 를 NERV 가 내보낸 읽기 전용 미러로 본다 |
| 시행 가드(`dto-jsdoc-citation-guard.ts`) | 세 정규식이 리뷰 세션 디렉터리 이름 형태를 찾는다 | 전환 단계 4g 에서 NERV 발견 인용(`finding <ID>`)을 네 번째 형태로 더했다(강제 범위 표) |
| Rationale «PR 번호로 전환하지 않은 이유» | 세션 경로가 git 이력으로 풀리고 라운드별 지적까지 가리킨다 | 새 리뷰에는 세션 경로가 없다. 기존 인용은 저장소 이력의 경로를 그대로 가리킨다 |
| `code:` 의 준수 예시 | 이 규약을 지키는 파일을 스펙 frontmatter `code:` 에 적는다 | 이번 이전에서 `code:` 는 본문의 `## 구현 위치` 절로 옮겼다([스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md)) |

## 구현 위치

준수 예시(이 규약이 처방하는 인용 형태를 실제로 쓰는 파일):

- `codebase/backend/src/common/guards/roles.guard.spec.ts`
- `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`

시행 코드 — 규칙 6(응답 DTO). 응답 DTO JSDoc 의 옛 경로 형태와 NERV 발견 인용을 AST 로 강제한다. 컨트롤러 축과 요청 DTO 축은 강제하지 않는다.

- `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts`

대조군(위 응답 DTO 시행 코드가 잡아야 하는 위반 형태와 잡지 않아야 하는 준수 형태의 실례):

- `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/jsdoc-citation*.ts`

시행 코드 — 규칙 9 · 10(`review-citation-form`). `codebase/**` 텍스트 파일에서 줄인 발견 ID 와 `.review/` 아래 네 종류 디렉터리 경로가 0 인지 본다. 대조군은 테스트 안의 합성 입력과 허용 목록 낡음 검사다.

- `codebase/frontend/src/lib/docs/__tests__/review-citation-form.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/codebase-mentions.ts` (공용 순회와 두 형태의 정규식)

## Rationale

### 규약을 만들 때의 실측 (2026-09-05)

`origin/main` 의 `codebase/` 안에 리뷰 산출물 인용이 **107개 파일·514회** 있었다(2026-09-05 09시 측정). 날짜를 확인할 수 있는 인용 중 가장 이른 것은 2026-05-26 리뷰 세션이다. 날짜 없는 형태는 날짜가 없어 그보다 이른 것이 있는지 알 수 없다. 그 점이 규칙 2 의 근거이기도 하다.

- `scripts/**`·`.github/**`: 인용 8건 중 6건이 날짜 없는 형태였다. 이미 이 규약이 필요한 상태였다.
- `spec/**`: 18개 파일·45건 중 36건이 날짜 없는 형태였다.

### 인용을 유지하는 근거

전환 단계 2 전까지 `review/**` 는 커밋됐다. `.gitignore` 가 무시하는 것은 `review/**/_prompts/` 한 줄뿐이었다. `SUMMARY.md`·`<role>.md`·`meta.json`·`RESOLUTION.md` 는 저장소에 남았다(2026-09-05 `git check-ignore` 실측).

전환 단계 3 에서 작업 트리의 `review/` 를 지워도 이 근거는 그대로다. 2026-10-01 실측으로 `codebase/` 의 옛 경로 인용은 97개 파일 · 350회다(`git grep -o -E "review/(code|consistency|merge|spec-coverage)/20[0-9]{2}/" -- codebase`). 단계 3 뒤에는 이 인용 모두 작업 트리에 대상이 없고 `git log -- <경로>` 로만 되짚는다.

다만 "영구" 라고까지는 말하지 않는다. 옛 산출물을 정리한 적이 있다(`f7c56bf0a`, `refactor(plan,review): delete`). 2026-09-05 실측으로 전체 경로 인용 중 1건(`review/code/2026/05/26/12_10_38`)이 작업 트리에 없다. 그래도 git 이력에는 남아 있어 `git log -- <경로>` 로 되짚을 수 있다.

이것이 규칙 2 의 진짜 근거다. 경로 인용은 정리돼도 이력으로 풀린다. 날짜 없는 `hh_mm_ss` 는 이력으로도 풀리지 않는다. 어느 날짜인지가 어디에도 없기 때문이다.

### 날짜를 넣는 근거

리뷰 세션 시각은 날짜를 넘어 겹친다. 2026-09-05 실측(`origin/main` 기준)은 다음과 같다.

| 항목 | 값 | 성격 |
| --- | --- | --- |
| 둘 이상의 날짜에 같은 시각이 있는 경우 | **46개** | 라운드가 늘수록 커진다 |
| `codebase/**` 가 인용한 서로 다른 시각 | 197개 | |
| **그중 여러 날짜에 걸려 풀 수 없는 것** | **8개** | **이 규약의 근거** |

리뷰 세션 디렉터리 총수는 적지 않는다. 리뷰를 한 바퀴 돌 때마다 늘어서 어떤 값을 적어도 곧 낡는다. 실제로 이 규약을 쓰는 동안에도 늘었다. 위 세 줄은 `origin/main` 기준이라 머지 전까지 고정이다. 판단에 쓰는 것은 마지막 줄이다.

### `code:` 가 구현 경로 대신 준수 예시를 가리키는 이유

[스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 은 `code:` 를 "이 스펙이 약속한 표면의 구현 경로" 로 정의한다. 이 규약은 처음에 강제하는 코드가 없었다. 주석 형태를 강제하는 가드가 없었기 때문이다. 그래서 `code:` 에 **이 규약이 처방하는 형태를 실제로 쓰는 파일**을 적었다. backend·frontend 에서 하나씩 골랐다. 이 예외는 [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 의 `code:` 필드 정의에 함께 적었다. 한쪽만 다시 해석하면 기준 문서가 그 사실을 모른다.

2026-09-06 부터는 한 축의 절반이 강제된다. `dto-jsdoc-citation-guard.ts` 가 "응답 DTO 의 `/** */` JSDoc 에 리뷰 인용을 쓰지 않는다" 를 AST 로 센다. 같은 위반이 세 번 났고 세 번 다 사람이 읽고 잡은 것이 계기다(`review/code/2026/09/06/12_28_02` W2). 그래서 `code:` 는 준수 예시 말고 시행 코드도 담게 됐다. 지금 구현 위치가 담는 범주는 다음과 같다.

| 항목 | 범주 |
| --- | --- |
| `roles.guard.spec.ts` · `sanitize-loader-error.ts` | 준수 예시 |
| `dto-jsdoc-citation*.ts` | **시행 코드**. 응답 DTO 행을 강제한다 |
| `fixtures/dto/responses/jsdoc-citation*.ts` | 대조군. 위 시행 코드가 잡아야 할 위반과 잡지 않아야 할 준수 형태 |
| `review-citation-form.test.ts` | **시행 코드**. 규칙 9 · 10 의 `codebase/**` 행을 강제한다(2026-10-03) |
| `codebase-mentions.ts` | 공용 모듈. 세 가드가 함께 쓰는 순회와 정규식 |

frontmatter 에도 같은 구분을 인라인 YAML 주석으로 적었다(`review/consistency/2026/09/06/13_18_59` INFO#2 의 제안). 그 주석이 처음에는 `review_guard` 파서의 결함 때문에 항목을 떨어뜨렸다(그 파서는 전환 단계 2 에서 spec-linked 변경에 `--impl-done` 을 요구하던 게이트와 함께 없어졌다). 파서를 고친 경위는 [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) Rationale «`code:` 목록에 주석을 허용한 경위» 에 있다.

기각한 대안: `codebase/backend/src/**` 처럼 넓은 트리를 적기. 가드는 통과하지만 이 저장소의 다른 규약 문서가 `code:` 를 좁고 구체적인 파일로 적는 관행과 어긋난다. 무엇보다 아무것도 가리키지 않는 것과 같다.

### PR 번호로 전환하지 않은 이유

`review/code/2026/09/05/00_06_38` W2 는 "영구 코드 주석에 일시적 프로세스 식별자" 라며 PR 번호·커밋 SHA 로 바꾸자고 제안했다. 두 가지 이유로 택하지 않았다.

- **전제가 틀렸다.** 세션 ID 는 일시적이지 않다. `review/**` 가 커밋됐으므로 경로는 정리된 뒤에도 git 이력으로 풀린다. 문제는 날짜가 빠진 인용 형태였고 인용 대상은 문제가 없었다.
- **전환 비용이 손실이다.** 기존 인용 514회가 모두 고아가 된다. PR 번호는 입도도 잃는다. PR 에는 라운드별 산출물이 없어 "어느 라운드의 어느 지적" 을 가리키지 못한다. 세션 경로는 그것을 그대로 준다.

### 소급 정리를 하지 않는 이유

날짜 없는 인용의 날짜는 커밋 시각으로 어림할 수 있지만 **어림은 틀릴 수 있다**. 한 파일이 여러 날의 라운드를 인용하는 경우가 흔하다. 잘못 채운 경로는 날짜 없는 인용보다 나쁘다. 실제로 있는 **다른** 세션을 가리켜 읽는 사람이 엉뚱한 근거를 읽게 된다. 그 자리를 아는 사람이 손볼 때 맞추는 편이 옳다.

### DTO JSDoc 행과 `plan/**` 제외를 명시한 이유

이 규약과 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) §3 이 같은 날 등재되면서 표면이 겹쳤다. JSDoc 에 리뷰 인용을 넣으면 이 규약은 만족하고 저쪽은 어기게 된다(`review/consistency/2026/09/05/09_53_09` W1). 두 규약이 서로를 모르는 상태를 남기지 않으려고 DTO JSDoc 행을 뒀다.

`plan/**` 제외는 `review/code/2026/09/05/09_27_04` INFO#3 이 "같은 PR 이 `plan/**` 에는 날짜 없는 인용을 계속 넣는다" 고 물어서 명시했다. 의도한 제외다.

### 수치는 재고 적는다

`spec/**` 행을 처음 넣을 때 "현재 위반 사례 0건" 이라고 적었다. 재지 않고 쓴 것이다. `review/code/2026/09/05/10_39_00` W1 이 반증했고 직접 세어 보니 18개 파일·45건 중 36건이 날짜 없는 형태였다. 리뷰어가 센 값(12개 파일·22곳)보다도 많았다. 같은 문서 안에서 다른 범위(`codebase/**`, `scripts/**`)는 모두 실측해 놓고 이 행만 짐작으로 채웠다. 범위를 넓히는 편집에는 그 범위를 재는 일까지 들어간다.

이 관례의 규모를 처음 셀 때(`review/code/2026/09/05/00_06_38` 라운드) `-E "\b[0-9]{2}_…"` 정규식이 걸리지 않아 "0건" 이 나왔다. 하마터면 "선례 없음, 이 PR 의 일탈" 이라는 정반대 결론을 낼 뻔했다. 확실히 있는 문자열로 명령 자체를 먼저 검증해서 잡았다. 이 문서의 수치는 모두 그 절차를 거쳤다. 0 은 늘 "없다" 와 "못 찾았다" 두 가지로 읽힌다.

### 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)

적용 범위 표는 원래 "DTO·컨트롤러의 JSDoc" 한 행이었고 근거를 "공개 OpenAPI `description` 으로 나간다" 로 적었다. 빌드 산출물로 다시 재 보니 이 근거는 **필드 JSDoc 에만 맞았다**. 플러그인의 `_OPENAPI_METADATA_FACTORY` 는 프로퍼티 메타데이터만 만들고 `TriggerWorkflowRefDto` 의 클래스 JSDoc 문구는 산출물 어디에도 없었다(`codebase/backend/dist`, 2026-09-27). 클래스 수준 설명은 `@ApiSchema({ description })` 를 명시하면 스키마에 실린다.

그래서 클래스 JSDoc 에 대해 두 방향을 검토했다. 질문은 `#1292` 가 트래커에 남겼고 두 선택지는 이 결정에서 처음 적었다.

| 방향 | 내용 | 비용 |
| --- | --- | --- |
| (A) 클래스 JSDoc 을 `//` 와 같게 본다 | 인용을 허용한다(규칙 2~4 형식만 지키면 된다). 가드는 프로퍼티 JSDoc 만 세도록 좁힌다 | 가드를 느슨하게 한다. 쓰는 사람이 "이 `/** */` 가 밖으로 나가는가" 를 플러그인 구현으로 판단해야 한다 |
| (B) 필드와 같이 "쓰지 않는다" | 가드는 그대로 둔다(클래스·프로퍼티를 함께 센다). 기존 두 자리를 `//` 로 옮긴다 | 두 자리 편집 |

**(B) 를 택했다.** 규칙의 경계가 "응답 DTO 파일의 `/** */`" 하나면 쓰는 사람이 플러그인의 어느 메타데이터가 스키마에 실리는지 알 필요가 없다. (A) 는 그 판단을 규칙 안으로 끌어들이고 이미 두 축을 함께 세는 가드를 느슨하게 만든다. 클래스 수준 설명이 필요해지면 `@ApiSchema({ description })` 로 명시하게 되는데 그 설명을 JSDoc 에서 옮겨 적는 순간 인용도 함께 따라 나간다. 처음부터 `/** */` 에 인용을 두지 않는 편이 그 경로를 막는다.

DTO JSDoc 행을 둘 때(2026-09-05) 적은 "실제 위반 사례는 없지만" 은 그 시점에는 맞았다. 다음 날 클래스 JSDoc 인용 두 건이 들어왔고(`#1291`), 가드가 그 둘을 동결했다가 이 결정으로 갚았다. 같은 근거 문장이 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) §3 에도 있어 거기에도 필드 한정을 붙였다.

### NERV 발견 인용 형식 (2026-10-01)

전환 단계 2 부터 새 리뷰는 `review/**` 경로를 만들지 않는다. 그래서 규칙 3 의 권장 형식은 새로 생기지 않고 새 리뷰를 가리킬 형식이 필요해졌다. 단계 2 의 일관성 검토(finding 01a0f6c1-82ee-70a0-bd66-0bee03bc92b6)가 이 공백을 찾았다.

NERV 발견 전체 ID 를 택했다.

- **저장소 정리와 무관하다.** 발견은 NERV 레코드라 저장소 파일 경로처럼 이동·삭제로 끊기지 않는다. 다만 NERV 의 레코드 보존 정책은 확인하지 않았다. 또 옛 경로는 `git log` 만으로 풀렸지만 발견 ID 를 풀려면 NERV 서버와 읽기 권한이 필요하다. 규칙 9 가 요지를 함께 적기를 권하는 이유다.
- **커밋 메시지와 같은 형식이다.** push 게이트는 라운드 뒤 커밋이 처분된 발견을 `finding <발견 전체 ID>` 로 인용하는지 커밋 메시지에서 읽는다(저장소 `.claude/skills/code-review-agents/SKILL.md` §4). 주석과 커밋 메시지가 한 형식을 쓰면 하나로 찾을 수 있다.
- **전체 ID 만 쓴다.** NERV 발견 ID 는 UUIDv7 이라 앞부분이 생성 시각이다. 2026-10-01 실측으로 한 제출의 발견 13건이 모두 `01a0f648-` 로 시작했다.

기각한 대안:

- **로컬 산출물 경로(`.review/**`)**: 커밋되지 않아 다른 체크아웃에는 없다. 그래서 규칙 10 으로 금지했다.
- **커밋 SHA**: 당시 plan 트래커의 `review/**` 인용 항목(작성 시점 경로 `plan/in-progress/spec-draft-nullable-notation-followups.md`)이 이미 이유를 적었다. 새 staleness 축이 생기고, `#1331` 이 라운드 4 에서 같은 이유로 SHA 핀을 거절했다. 발견 ID 는 리뷰 대상이 바뀌어도 같은 지적을 가리킨다.
- **`plan/` 경로**: 같은 항목이 적었듯 plan 은 완료하면 `in-progress/` 에서 `complete/` 로 옮겨져 끊긴다. 전환 단계 3 에서는 `plan/` 자체가 지워진다.
- **PR 번호**: 위 «PR 번호로 전환하지 않은 이유» 와 같다. 라운드별 지적을 가리키지 못한다.

전환 단계 4e 전의 통합 검토(`kind=merge`) · spec-coverage 감사(`kind=spec_coverage`) 결과는 Task 키로 가리킨다(규칙 9). 그 결과에는 발견이 없고 그 결과로 올린 NERV Task 가 유일한 NERV 레코드이기 때문이다. Task 키에도 발견 ID 와 같은 접근 한계가 있다. NERV 서버와 읽기 권한이 있어야 풀린다. 리뷰 인용을 보는 두 가드(`dto-jsdoc-citation` · `review-citation-form`)는 이 형태를 보지 않는다.

### 시행 가드를 넓힌 경위 (2026-10-03, 전환 단계 4g)

시행 가드는 전환 단계 4g(NERV Task `CLE-T-M7K35H`)에서 두 갈래로 넓혔다.

- 응답 DTO JSDoc 가드(`dto-jsdoc-citation`)에 `finding <ID>` 형태를 더했다. 규칙 6 의 경계(응답 DTO 파일의 `/** */`)는 그대로다. 대조군 fixture 에 전체 ID 위반 · 줄인 ID 위반과 9자리 · 10자리 16진 준수 예를 뒀다. UUID 꼬리를 필수로 바꾼 정규식과 끝 경계를 지운 정규식은 이 대조군에서 실패한다.
- 규칙 9 · 10 이 금지한 두 형태(줄인 발견 ID, `.review/**` 경로)는 codebase 텍스트 파일 전체에서 0 을 요구하는 별도 가드(`review-citation-form`)로 막았다. 두 형태는 자리와 무관하게 금지라서 응답 DTO JSDoc 만 보는 가드로는 덮을 수 없다. 2026-10-03 실측으로 둘 다 0건이라(가드 자신의 파일과 허용 목록의 대조군 제외) 기준값을 두지 않았다.

같은 실측은 아래 명령으로 다시 잴 수 있다. 앞 정규식은 규칙 9 의 형태, 뒤 정규식은 규칙 10 의 형태를 ERE 로 옮긴 것이다. 가드 자신의 파일과 대조군은 금지 형태를 일부러 담고 있어 제외 pathspec 으로 뺀다.

```sh
git grep -nE '(^|[^[:alnum:]_])finding[[:space:]]+[0-9a-f]{8}([^0-9a-f-]|$)|(^|[^[:alnum:]_-])\.review/(code|consistency|merge|spec-coverage)/' \
  -- codebase scripts .github \
  ':!codebase/frontend/src/lib/docs/__tests__/review-citation-form.test.ts' \
  ':!codebase/frontend/src/lib/docs/__tests__/codebase-mentions.ts' \
  ':!codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/jsdoc-citation.fixture.ts'
```

`review-citation-form` 은 `codebase/**` 만 본다. `scripts/**` · `.github/**` 의 파일 확장자(`.yml` · `.py` · `.json` · `.sh` · `.md`)는 모두 확장자 목록 안에 있다. 순회 함수는 루트로 준 점 디렉터리(`.github`)도 훑는다. 건너뛰기는 하위 디렉터리에만 걸린다. 그래도 범위를 넓히지 않은 것은 2026-10-03 실측으로 두 트리 모두 0건이기 때문이다. 금지 형태가 생기면 그때 `MENTION_ROOTS` 를 넓힌다. `MENTION_ROOTS` 는 세 가드가 함께 쓰므로 넓히면 `legacy-path-ratchet` · `spec-key-mentions` 의 범위도 함께 넓어진다.

`spec/**` 은 NERV 스펙의 읽기 전용 미러라 저장소에서 고칠 수 없다. 그래서 저장소 가드를 두지 않고 본문은 NERV 에서 검토한다.

응답 DTO JSDoc 의 `.review/` 아래 code · consistency · merge 날짜 · 시각 경로는 `dto-jsdoc-citation` 의 첫 패턴에도 걸린다. 이 겹침은 우연이고 보장이 아니다. 규칙 10 을 지키는 가드는 `review-citation-form` 이다. 응답 DTO JSDoc 에 인용을 쓰지 않는 규칙 6 은 형식과 무관하게 그대로다.
