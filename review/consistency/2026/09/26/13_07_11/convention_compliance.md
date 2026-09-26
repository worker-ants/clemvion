# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-swagger-success-advert.md`

## 검토 범위

- target: `plan/in-progress/spec-draft-swagger-success-advert.md` (spec draft, `--spec` 모드)
- 대조 규약: `spec/conventions/swagger.md` (전문 로드), `plan/complete/spec-draft-swagger-http-status-guard.md` ·
  `plan/complete/spec-draft-swagger-forbidden-codes.md` (동일 문서·동일 저자의 직전 두 선례 — 형식 대조군), CLAUDE.md
  §정보 저장 위치 / plan-lifecycle §4.

## 발견사항

- **[WARNING]** §5-4(swagger.md 자체 절)와 §5.4(api-convention 절)의 번호 표기 혼용
  - target 위치: `## Rationale (이 draft 의)` 두 번째 불릿 (line 67) — `"§5-4 는 wire 의 \`null\` 을 \`nullable\` 로 선언하라고
    한다(api-convention §5.4)."`
  - 위반 규약: 명시적 문서화 규칙은 아니지만, 저장소 전역에서 **하이픈 번호(`§X-Y`)는 그 문서 자신의 절, 점 번호(`§X.Y`)는
    `api-convention`/`5-system` 문서의 절**을 가리키는 표기가 일관되게 지켜지고 있다 — `spec/conventions/swagger.md` 자신이
    `§1-4`·`§2-4`·`§5-4`(하이픈, 자기 절)와 `[API 규약 §5.4](../5-system/2-api-convention.md#54-...)`(점, 타 문서 절)를 명확히
    구분해 쓰고(예: line 233, 307, 515, 605 근방), 바로 동일 저자·동일 날짜의 선례 `plan/complete/spec-draft-swagger-http-status-guard.md`
    도 `"§5.4 «검증 층» 의 이중 등재 규칙"`처럼 api-convention 절은 항상 점 번호로 인용한다. 또한 이 프로젝트는 이 종류의 절
    번호 오표기를 전담 추적하는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커를 별도로 두고 있을 만큼
    민감하게 다룬다.
  - 상세: swagger.md 자신의 §5-4 는 "새 엔드포인트 체크리스트"이며 nullable 선언 규칙과 무관하다. 그런데 target 문장은
    `"§5-4 는 wire 의 null 을 nullable 로 선언하라고 한다"` 라고 적어, 하이픈 번호만 읽으면 **swagger.md 자신의 §5-4 가 그 규칙을
    정하는 것처럼** 오독된다. 괄호 안 `"(api-convention §5.4)"` 로 뒤늦게 정정하고 있으나, 문장의 주어 자리를 이미 잘못된 번호가
    차지하고 있어 인용 형식이 선례와 어긋난다.
  - 제안: `"§5-4 는 ..."` → `"api-convention §5.4 는 ..."` (주어를 문서 한정자 + 점 번호로 바꾸고, 괄호 정정을 없앤다). 이 문장은
    `## Rationale (이 draft 의)` 하위라 swagger.md 본문에 그대로 삽입되지는 않으므로 파급은 이 plan 문서 자체로 국한되지만,
    같은 draft 를 나중에 참조할 사람이 절 번호로 혼동할 수 있어 정정을 권한다.

- **[INFO]** 제목이 두 절(§2-4·§5-2)을 한 줄에 결합
  - target 위치: frontmatter `title` (line 2) — `"swagger.md §2-4 — 라우트는 성공 응답을 하나 이상 광고한다 · §5-2
    \`ApiOkWrappedNullableResponse\`"`
  - 위반 규약: 강제 규칙은 아님. 직전 두 선례(`spec-draft-swagger-http-status-guard.md`, `spec-draft-swagger-forbidden-codes.md`)의
    제목은 모두 `"swagger.md §<단일 절> — <설명> (가드 등재)"` 형태로 절 하나만 가리킨다.
  - 상세: 이번 draft 는 실제로 §2-4 와 §5-2 두 절을 함께 고치므로 두 절을 한 제목에 담은 선택 자체는 합리적이고, `·` 구분자로
    가독성도 유지된다. 다만 형식이 선례와 달라지므로, 이후 같은 패턴(복수 절 동시 개정)이 반복되면 제목 형식을 규약화할지
    검토할 만하다.
  - 제안: 수정 불요 — 필요시만 참고.

## 검증한 항목 (문제 없음)

- 파일 위치·명명: `plan/in-progress/spec-draft-swagger-success-advert.md` — `spec-draft-*` prefix 는 저장소에 100건 이상의
  선례가 있는 확립된 명명 패턴이며 위치도 `plan/in-progress/`로 정확.
- frontmatter 3필수 필드(`worktree`/`started`/`owner`) 모두 존재, `worktree: success-advert` 는 현재 worktree 디렉토리와 일치,
  `started` 는 `YYYY-MM-DD` 포맷 준수, `owner: project-planner` 는 skill 표의 정식 role 명과 일치(가장 최근 두 선례와 동일 표기).
  `status: in-progress` 는 `plan/complete/**` 전용 종료값 강제 대상이 아니므로(§4) 허용.
  `spec_impact: [spec/conventions/swagger.md]` 는 실재 spec 경로 단일 리스트로 Gate C 형식 위반 없음(단, in-progress 단계라 아직
  강제 대상도 아님).
- `## 변경 (1)~(4)` 가 인용하는 원문(§2-4 마지막 문장, §5-2 표, §5-4 체크리스트, §2-4 Rationale 불릿)을 실제
  `spec/conventions/swagger.md` 파일과 대조한 결과 **문자 단위로 정확히 일치** — 앵커 인용 오류 없음.
  (`plan/complete/success-advert.md` 참조는 아직 `plan/in-progress/`에 있으나, 이는 이 draft 가 삽입될 시점엔 구현 plan이
  `complete/`로 이동해 있을 것을 전제한 선행 참조이며, 직전 선례 `spec-draft-swagger-http-status-guard.md` 도 동일 패턴을 썼다.)
- 신설 헬퍼명 `ApiOkWrappedNullableResponse(Dto)` — `common/swagger/api-wrapped.ts` 의 기존 명명 패턴(`ApiOkWrappedResponse` ·
  `ApiOkWrappedOneOfResponse` · `ApiOkWrappedArrayResponse` · `ApiOkPaginatedResponse`, 즉 `Api<Status>Wrapped<Modifier>Response`)과
  정확히 같은 축. 현재 이 축에 nullable 변형이 없어 신규 도입 자체도 타당.
  반환 스키마 `{ data: <Dto> | null }` 은 api-convention §5.4(부재 표현) 의 "상시 존재 + null" 기본 표현과 부합.
- 테이블 셀 내 파이프 이스케이프(`` \| ``)는 `spec/1-data-model.md`·`spec/2-navigation/*.md` 등 저장소 전역 선례와 동일하게 적용됨.
- `@ApiFoundResponse` 는 `@nestjs/swagger` 가 실제로 export 하는 302 전용 데코레이터(확인: `node_modules/@nestjs/swagger/dist/decorators/api-response.decorator.d.ts`) — API 문서 도구 데코레이터 명명 규약 위반 없음.
- `## Rationale (이 draft 의)` 섹션 표제·불릿 형식(굵은 소제목 + 기각한 대안 명시)은 동일 계열 선례 두 건과 동형이며,
  "기각한 대안" 불릿도 실제로 이 draft 작성 중 검토한 대안(`sessions/latest` 404화)을 근거로 들어 소급 정당화가 아님.
- `## 변경 (2)` 삽입 위치(`ApiOkWrappedResponse(Dto)` 행 바로 아래)는 "200 OK 단일 객체 계열" 헬퍼들을 인접시키는 합리적 배치.
- 금지 항목(§1-7 `Patch` 접두 금지, §6 빈 껍데기 스키마 금지, §5-1 엔티티 노출 금지, discriminator unsound 금지 등) 재도입 없음 —
  이번 draft 범위(§2-4/§5-2) 밖.

## 요약

target 문서는 `plan/in-progress/` 명명·frontmatter 스키마·spec-draft 문서 구조(도입부/변경 목록/Rationale)를 동일 계열 직전
두 선례(`spec-draft-swagger-http-status-guard.md`, `spec-draft-swagger-forbidden-codes.md`)와 형식적으로 매우 밀접하게 따르고
있고, `swagger.md` 원문 인용도 문자 단위로 정확하며, 신설 헬퍼 `ApiOkWrappedNullableResponse` 의 명명·반환 스키마도 기존
`common/swagger` 명명 축과 api-convention §5.4 부재 표현 규칙에 부합한다. 유일한 흠은 draft 자체 Rationale 안에서 api-convention
§5.4 를 가리키며 하이픈 번호(§5-4, swagger.md 자신의 다른 절과 충돌)를 주어로 쓴 인용 오류로, 이 프로젝트가 별도 트래커까지
두고 민감하게 관리하는 절 번호 표기 규칙에 어긋난다. 해당 문장은 `## Rationale (이 draft 의)` 하위라 실제 `swagger.md` 본문에
삽입되지는 않으므로 파급은 제한적이다.

## 위험도

LOW
