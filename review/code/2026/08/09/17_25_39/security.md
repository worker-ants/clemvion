# 보안(Security) 리뷰 — backend-typecheck-gap-3d7a91

## 검토 범위 요약

이번 diff 는 크게 네 갈래다: (1) backend CI 게이트 신설(`backend-checks.yml` lint/unit/typecheck-ratchet 3잡) + 관련 하네스 가드 3개(`test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`, `harness-checks.yml` paths), (2) `*.spec.ts` 5개의 순수 타입 정합 수정(생성자 인자 미러링, import 추가), (3) `SecretResolverService.deleteByPrefix()` 의 LIKE 메타문자 거부 가드 신설(+ 대응 테스트), (4) plan 문서·consistency-check 산출물(순수 문서). 코드 실행 경로에 새로 유입된 보안 관련 로직은 사실상 (3) 뿐이며, 나머지는 CI 배관·타입 정합·문서다.

## 발견사항

- **[INFO]** `deleteByPrefix()` 신규 검증이 예외 메시지에 `prefix` 원문을 전량 포함 — 같은 파일의 기존 SS-SE-05 정책(값 절단)과 불일치
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:166`, `:171` (`throw new Error(... 받음: "${prefix}" ...)`)
  - 상세: 같은 파일의 `assertRefFormat()`(`secret-resolver.service.ts:56-70`, 주석 "SS-SE-05: plaintext 를 에러 메시지·로그에 포함 금지")는 잘못된 `ref` 값을 절대 그대로 에러에 싣지 않고 길이 + 앞 8자만 노출한다 — 호출자가 실수로 plaintext 를 ref 자리에 넘겼을 가능성까지 방어하기 위한 설계다. 반면 이번에 추가된 `deleteByPrefix` 의 두 가드(`secret://` 접두사 검사, LIKE 메타문자 검사)는 `prefix` 인자를 절단 없이 통째로 에러 메시지에 넣는다. 현재 유일한 프로덕션 호출부(`codebase/backend/src/modules/triggers/triggers.service.ts:875`, `secret://triggers/${trigger.id}/` — DB `@PrimaryGeneratedColumn('uuid')`)는 서버 생성 UUID 라 실질적 노출 위험은 없다고 확인했으나, 이는 "호출부 목록이 그대로일 때만" 참이라는 이 fix 자체의 논리(주석 153-157행)가 이 신규 코드 자신에도 그대로 적용된다. 향후 사용자 입력이 섞인 prefix(예: 외부 제공 리소스 식별자)를 넘기는 호출부가 생기면, `deleteByPrefix` 의 에러 메시지가 그 값을 절단 없이 로그/스택트레이스에 노출하는 유일한 경로가 된다.
  - 제안: `assertRefFormat` 과 동일하게 `prefix` 도 길이 + 앞 N자만 에러 메시지에 포함하도록 맞추면 이 파일 전체의 "ref/prefix 원문 미노출" 정책이 일관되게 유지된다. 현재 호출부가 안전하다는 사실만으로는 종결하지 않는 편이 이 PR 이 채택한 "입력 자체를 거부" 논리와 정합적이다.

- **[정보 — 긍정적 발견]** `deleteByPrefix()` LIKE 메타문자 거부는 올바르고 방어가 충분함
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:169-174`
  - 상세: `%`·`_` 뿐 아니라 PostgreSQL `LIKE` 의 기본 escape 문자인 `\`(백슬래시)까지 정규식 `/[%_\\]/` 으로 함께 차단해 `ESCAPE` 절 없이도 우회 여지를 남기지 않았다. TypeORM 파라미터 바인딩(`.where('ref LIKE :prefix', { prefix: ... })`)이라 SQL 인젝션 자체는 애초에 없었고, 이번 변경은 "의도보다 넓게 삭제되는" 과다 삭제 위험을 막는 입력 검증 강화다. 정상 호출부(내부 생성 UUID prefix)를 막지 않는지도 테스트로 고정되어 있다(`secret-resolver.service.spec.ts` "통과 — 실제 호출부 형태" 케이스). 새로운 취약점이 아니라 기존 INFO 항목(plan 문서에 기록된 ai-review 지적)을 닫는 정당한 보강.

- **[INFO]** `backend-checks.yml` 신규 워크플로 — 시크릿/인젝션 관점 이상 없음(확인 목적 기록)
  - 위치: `.github/workflows/backend-checks.yml` (`changes` 잡의 `env:` 블록, 25-69행)
  - 상세: `github.event.pull_request.base.sha` 등 PR 이벤트에서 유래하는 값들을 `run:` 문자열에 직접 보간하지 않고 `env:` 로만 전달해 `scripts/ci-paths-changed.sh` 가 환경변수로 읽게 했다 — GitHub Actions 의 대표적 스크립트 인젝션 패턴(`${{ }}` 를 `run:` 셸 문자열에 직접 삽입)을 정확히 회피한 안전한 구조다. `pull_request`(포크 PR 포함) 트리거이지만 잡들이 시크릿을 전혀 참조하지 않고 `pnpm install --frozen-lockfile` + lint/test/typecheck 만 수행하므로, 기본 `GITHUB_TOKEN`(read-only) 이상의 권한 노출도 없다. 별도 조치 불요, 확인 완료 기록.

이 외 `.claude/tests/*`, `harness-checks.yml` paths 추가, `*.spec.ts` 5개의 타입 시그니처 정합 수정, `plan/`·`review/consistency/` 문서 변경에서는 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 로그 노출 등 보안 관점 이슈를 발견하지 못했다.

## 요약

이번 diff 의 유일한 보안 관련 런타임 변경은 `SecretResolverService.deleteByPrefix()` 에 LIKE 메타문자(`%`/`_`/`\`) 거부 가드를 추가한 것으로, 기존에 INFO 로만 기록되어 있던 과다 삭제 위험을 TypeORM 파라미터 바인딩(SQLi 자체는 원래 없었음) 위에 입력 검증으로 한 단계 더 방어한 정당한 보강이며 정상 경로 보존까지 테스트로 고정했다. 유일한 지적 사항은 이 신규 가드의 에러 메시지가 같은 파일의 기존 SS-SE-05(에러 메시지에 원문 미노출) 정책과 달리 `prefix` 값을 절단 없이 그대로 노출한다는 점으로, 현재 호출부가 서버 생성 UUID 뿐이라 실질 위험은 없으나 방어적 일관성 차원에서 절단을 권한다(INFO). CI 워크플로 신설분은 시크릿을 다루지 않고 `${{ }}` 값을 `env:` 경유로만 사용해 스크립트 인젝션 패턴을 정확히 피했다. 그 외 변경은 CI 하네스 테스트·타입 시그니처 정합·문서로 보안 표면에 영향을 주지 않는다. Critical/Warning 급 발견은 없다.

## 위험도
NONE
