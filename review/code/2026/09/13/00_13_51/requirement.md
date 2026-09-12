# 요구사항(Requirement) 리뷰 — keyset 커서 id 성분 검증 (filter-pg-invalid-text)

## 발견사항

- **[WARNING]** `isUuidShaped` 캐너리 docstring 의 "세는 법" 이 스스로 규정한 개수와 다르다 — grep 명령을 그대로 돌리면 3곳이 아니라 4곳이 나온다.
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:61-67` (게이트 번호 기준, `> \`\`\`bash` ~ `> 2026-09-12 실측은 3곳(...)이다.`)
  - 상세: docstring 은 "개수를 다시 박지 않는다 — 또 낡는다. 세는 법을 적는다" 라며 다음 명령을 근거로 "2026-09-12 실측은 3곳(`workspace-context.util.ts`·`login-history.service.ts`·`background-runs.service.ts`)" 이라 적었다.
    ```
    grep -rn 'isUuidShaped(' --include='*.ts' codebase/backend/src \
      | grep -v '\.spec\.ts' | grep -v 'shared/testing/'
    ```
    실제로 이 명령을 그대로 실행하면(리뷰 중 재현):
    ```
    codebase/backend/src/common/utils/uuid.ts:45:export function isUuidShaped(value: string): boolean {
    codebase/backend/src/common/utils/workspace-context.util.ts:74:  if (headerWorkspaceId && !isUuidShaped(headerWorkspaceId)) {
    codebase/backend/src/modules/auth/login-history.service.ts:65:  if (!isUuidShaped(id)) return null;
    codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178:      if (!isUuidShaped(parsed.i)) {
    ```
    즉 **4줄**이 나온다 — 함수 **정의부**(`uuid.ts:45`)가 `isUuidShaped(` 패턴에 걸리는데, 이 명령은 정의부를 걸러내지 않는다. docstring 이 말하는 "3곳"은 "호출부(consumer)" 3곳을 뜻하지만, 그걸 걸러내려면 `grep -v 'uuid\.ts:'` 같은 추가 필터가 필요하다 — 문서화된 명령 자체엔 없다.
    이 docstring 의 존재 이유가 정확히 "다음 사람이 같은 명령으로 재검증해서 캐너리 배치가 최신인지 확인한다" 인데, **그 명령을 최초로 돌리는 순간부터 이미 문서 숫자와 어긋난다.** 다음 사람이 이 명령을 그대로 돌리면 "소비처가 4곳으로 늘었다"고 오판하거나(정의부 포함을 모르면), 혹은 "명령이 3을 보장 못 하네" 라고 다시 이 경계를 의심하게 된다 — 어느 쪽이든 "개수 재-하드코딩을 피하기 위한" 원래 의도를 정확히 무효화한다.
  - 제안: 명령에 정의부 제외 필터를 추가한다(예: `grep -v 'uuid\.ts:'` 또는 `grep -v ':.*export function isUuidShaped'`), 또는 "3곳(정의부 제외)"라고 명시해 향후 재실행자의 혼란을 없앤다.

## 그 외 점검 결과 (발견사항 없음, 근거만 기재)

- **기능 완전성 / 비즈니스 로직**: `login-history.service.ts`·`background-runs.service.ts` 두 `decodeCursor` 모두 keyset 커서의 id 성분을 `isUuidShaped` 로 검증하도록 정확히 배선됐고, 각자의 **기존 실패 계약**(무시 vs `400 INVALID_CURSOR`)을 그대로 유지한다는 plan/CHANGELOG 의 서술과 코드가 line-level 로 일치한다.
- **엣지 케이스**: nil UUID(`00000000-…`)·대문자·leading space 등 `isUuidShaped`/`isValidUuid` 경계값은 `uuid.spec.ts` 기존+신규 테스트로 커버되며, 코드(`UUID_SHAPE_PATTERN`)와 spec 서술(`spec/data-flow/12-workspace.md` §"UUID 검증 강도 비대칭") 모두 "Postgres 가 파싱 가능한가"라는 동일 술어 기준을 유지한다. 새 회귀 테스트(`[대조군]`)가 정확히 이 경계(느슨한 술어 유지)를 고정한다.
- **에러 시나리오**: `background-runs.service.ts` 는 새 검증 실패를 기존 catch 블록이 던지는 `BadRequestException({ code: 'INVALID_CURSOR' })` 로 흡수하도록 배치돼 있어(같은 try 블록 내부에서 `throw new Error(...)`), 새 에러 코드를 추가하지 않고 기존 계약을 재사용한다 — CHANGELOG·plan 의 서술과 일치.
- **데이터 유효성**: `GlobalExceptionFilter` 에 22P02 분기를 추가하지 않기로 한 결정(plan §A)은 `spec/5-system/3-error-handling.md §1`("JWT 클레임은 검증하지 않는다 — 서버가 서명한 값이라 거기서 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다")의 기존 원칙과 실제로 일치함을 확인했다(`grep` 실측, `3-error-handling.md:80`). 필터의 기존 SQLSTATE 분기가 `23505 → 409` 뿐이라는 plan 의 표(§A)도 `http-exception.filter.spec.ts` 로 실측 확인됨.
- **반환값**: `login-history` 쪽 `decodeCursor` 는 검증 실패 시 `null` 을 반환해(기존 날짜/구분자 실패와 동일 경로) 시그니처(`{ ts: Date; id: string } | null`)를 그대로 지킨다. `background-runs` 쪽은 검증 실패를 catch 로 위임해 정상 반환 경로엔 영향이 없다.
- **spec fidelity**: `INVALID_CURSOR`/`INVALID_LIMIT`/`EXECUTION_NOT_FOUND`/`BACKGROUND_RUN_NOT_FOUND` 가 `spec/5-system/3-error-handling.md §1` 중앙 카탈로그에 없다는 사실을 확인했으나(`grep` 결과 미등재), `git log` 로 대조한 결과 이 네 코드는 **이번 diff 이전부터** 존재했다(`b677564e0` 이전 커밋에도 존재) — 이번 변경이 만든 신규 위반이 아니라 plan §D 에 이미 **planner 항목**으로 정확히 등재돼 있다. 새로 flag 하지 않음(중복 지적 방지).
- **TODO/FIXME**: 변경분에 TODO/FIXME/HACK/XXX 주석 없음.
- **뮤테이션 검증**: 리포지토리를 직접 뮤테이션하지 않고 `grep` 재현만으로 위 발견사항을 확인했다 — `git status --short` 로 저장소가 리뷰 시작 시점과 동일한 clean 상태(사전 존재하던 `review/**` untracked 산출물 제외)임을 확인함.

## 요약

커서 검증 로직 자체(id 성분에 `isUuidShaped` 적용, 두 엔드포인트의 기존 실패 계약 유지, 22P02→500 마스킹 방지)는 spec Rationale(`12-workspace.md` §"UUID 검증 강도 비대칭")·에러 카탈로그(`3-error-handling.md`)와 line-level 로 일치하며, 회귀 테스트(unit 4건 + e2e 2건, 실 DB 로 22P02→500 전제까지 실측)가 클래스뿐 아니라 대조군(느슨한 형태 통과)까지 고정하고 있어 완전성이 높다. 유일한 흠은 새로 추가된 `uuid.spec.ts` docstring 의 "재검증용 grep 명령"이 스스로 주장하는 개수(3)와 실제 실행 결과(4, 함수 정의부 포함)가 어긋난다는 점으로, 기능 결함이 아니라 "다음 사람이 이 캐너리 배치의 최신성을 검증하는 절차" 자체의 신뢰도를 떨어뜨리는 문서 정합성 결함이다.

## 위험도

LOW
