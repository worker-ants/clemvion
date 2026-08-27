# 요구사항(Requirement) 충족 리뷰 — masking-residuals-0b195b (C2 (a): config echo 마스킹을 어댑터→egress 로 이관)

## 발견사항

- **[CRITICAL]** "포함관계 캐너리"는 실제로는 `DEFAULT_SENSITIVE_KEYS` 에서 **파생되지 않는다** — 이 PR 의 핵심 안전 주장("목록이 넓어져도 자동 검사된다")이 실측으로 반증됨
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:126-127`("이 테스트가 자동으로 새 키를 검사한다"), `:130`("목록 자체에서 파생한다 — 손으로 나열하면 목록이 늘 때 조용히 통과한다"), `:129-172`(`describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축', …)` 블록). 같은 주장이 `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:42-44`, `spec/conventions/egress-masking.md:56`, `plan/in-progress/masking-expression-egress-split.md:65-66,103-104,124-129` 에 반복 인용됨.
  - 상세: `maskSensitiveFields()`(`mask-sensitive-fields.util.ts:80-89`)는 **모든** 입력 키를 그대로 `out[k]`에 복사한다 — sensitive 키는 마스킹하고 non-sensitive 키는 재귀 처리할 뿐, 어느 쪽도 **키 자체를 드롭하지 않는다**. 따라서 `Object.keys(maskSensitiveFields({...}))` 은 항상 **입력 객체 자신의 키 목록**과 동일하며, 실제 `DEFAULT_SENSITIVE_KEYS` Set 의 현재 내용과는 **무관**하다. 즉 `KEYS` 는 "목록에서 파생"된 것이 아니라, 스펙 파일 132~155행에 **손으로 다시 타이핑한 21개 키 리터럴**일 뿐이다.
    실측 (worktree 내 `cp` 백업으로 mutate 후 `git diff`로 원복 확인, `git checkout`/`reset` 미사용):
    1. `DEFAULT_SENSITIVE_KEYS` 에서 `'idToken'` 을 제거 → `mask-sensitive-fields.util.spec.ts` 전체 실행 결과 `1 failed / 40 passed / 41 total`. 실패한 것은 **기존의 명시적 `idToken` 테스트**(88-103행 블록)뿐이고, "포함관계 캐너리"의 `idToken` 케이스는 **여전히 생성되고 여전히 통과**했다(egress 쪽 정규식이 여전히 `idToken` 을 잡으므로). plan 문서(`masking-expression-egress-split.md:118-129`)는 이 결과를 "내 캐너리는 예상대로 조용히 줄었다"·"41→40" 이라고 서술하지만, **총 테스트 수는 41로 불변**이었고 캐너리의 케이스 수도 그대로였다 — plan 의 자체 실측 해석이 틀렸다.
    2. (반증을 완결하기 위해 추가 실측) `DEFAULT_SENSITIVE_KEYS` 에 egress `CREDENTIAL_KEY_PATTERN` 이 잡지 못하는 가상의 신규 키 `'oauthCred'` 를 추가(=이 파일의 관례 "새 접두형을 만나면 여기에 더한다"가 실제로 일어나는 미래 시나리오 재현) → 전체 스위트 `41 passed / 41 total`, **그 무엇도 실패하지 않았다**. 즉 "출구 중 하나를 빠뜨리는" 바로 그 위험(이 PR 이 "원리적으로 없다"고 주장하는 그 위험, `handler-output.adapter.ts:46`)이 **재현 가능**하고, 캐너리는 그것을 잡지 못한다.
  - 이 발견은 requirement 리뷰 관점 4(의도-구현 괴리)와 9(spec 본문 일치) 모두에 해당한다 — `spec/conventions/egress-masking.md:56` 이 "목록에서 파생하므로 목록이 넓어져도 자동 검사"라고 **사실 주장**으로 단언하는데 이는 거짓이다. 이 안전 주장은 바로 이 PR 이 이전 라운드의 CRITICAL(보안 Rationale 무효화, R-5)을 넘기는 근거로 쓰였으므로(`RESOLUTION.md`, `SUMMARY.md`), 그 근거 자체가 실측 불일치다.
  - 제안: `DEFAULT_SENSITIVE_KEYS` 를 (읽기 전용으로) export 하고 테스트에서 `Array.from(DEFAULT_SENSITIVE_KEYS)` 로 직접 순회하도록 캐너리를 재작성 — 그래야 목록이 실제로 늘 때 자동으로 새 케이스가 생긴다. 코드가 이미 `spec/conventions/egress-masking.md` 등 spec 문서에서 "자동 검사"를 사실로 서술하고 있으므로, 코드를 고치거나(우선) 그럴 수 없다면 spec/주석의 "자동 검사" 문구를 "수동 동기화 필요"로 정정해야 한다(이 부분은 spec 자체가 틀렸다기보다 **코드가 spec/주석이 약속한 속성을 실제로 구현하지 못한 경우**이므로 SPEC-DRIFT 가 아니라 CRITICAL 코드 결함으로 분류).

- **[INFO]** 코드 주석 자기교정이 문법적으로 깨진 문장을 남김 (부수적, 기능 영향 없음)
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:22-26`
  - 상세: 취소선 정정 구간이 원래 한 문장("이 상수는 `handler-output.adapter.ts` 도 쓰고 … DB·WS·표현식으로 내보낸다 — 비-자격증명 config 필드가 …")의 앞부분만 걷어내면서 동사를 "흘린다."로 바꿔 취소선 안에 넣었는데, 뒤에 원래 동사 "내보낸다 — 비-자격증명 config 필드가 …"가 그대로 남아 새로 삽입된 문장("…표현식은 원문을 읽는다.") 뒤에 주어 없는 조각으로 붙어 있다. 읽으면 "…원문을 읽는다. 내보낸다 — 비-자격증명 config 필드가 …" 로 이어져 문법이 깨진다.
  - 제안: 정정 시 원 문장 전체를 취소선 처리하거나, 남는 절("비-자격증명 config 필드가 이 이름들과 겹치면 멀쩡한 값이 가려진다")을 `DEFAULT_SENSITIVE_KEYS` 의 잔여 소비처(`explore-tools.service.ts`)에 대한 서술로 명시적으로 다시 연결.

- **[INFO]** plan 체크리스트가 이 diff 에 이미 포함된 작업을 미체크 상태로 남김
  - 위치: `plan/in-progress/masking-expression-egress-split.md:105-106`("어댑터에서 `maskSensitiveFields(config)` 제거 + …", "캐너리 — 표현식이 원문을 읽는다 …")
  - 상세: 두 항목 모두 이번 diff 에서 실제로 완료되어 있다(어댑터 코드·캐너리 테스트 모두 존재·통과). 체크박스만 `[ ]`로 남아 실제 상태와 어긋난다. `spec_impact` 6건도 이미 spec 파일 6개(파일 16-21)에 반영 완료됐는데 체크리스트의 "(planner 턴) 6개 spec" 항목도 `[ ]` 다.
  - 제안: 프로젝트 관례상 마무리 커밋(리뷰 이후)에서 체크할 수 있는 항목이므로 차단 사유는 아니나, `/ai-review` 후속 커밋에서 반드시 동기화할 것.

## 요약

핵심 코드 변경(`handler-output.adapter.ts` 에서 config echo 마스킹 제거 → 표현식/DB 는 원문, egress(REST/WS)만 마스킹)은 실제로 표현식 컨텍스트(`expression-resolver.service.ts:60`)가 `adapted.config` 를 그대로 읽는다는 점, REST(`redactStoredDataForResponse`)·WS(`maskWireEnvelope`)가 각각 `deepRedactSecrets*` 로 `outputData`(config 포함)를 실제로 가린다는 점, `CREDENTIAL_KEY_PATTERN` 정규식이 현재 `DEFAULT_SENSITIVE_KEYS` 의 22개 키를 전부 포함한다는 점까지 모두 코드 실행으로 확인되어, **현재 시점**의 기능·엣지케이스·회귀 방지(핸들러 spec 캐너리, 뮤테이션 M1/M3)는 잘 구현되어 있다. 다만 이 PR 이 "이제 새로 걸 출구가 없다·목록이 넓어져도 자동 검사된다"고 spec(`egress-masking.md`)·코드 주석·plan 문서에 반복해서 명시한 핵심 안전장치("포함관계 캐너리")는 실측 결과 **DEFAULT_SENSITIVE_KEYS 로부터 실제로 파생되지 않는 손타이핑 미러**였고, 신규 sensitive 키를 추가했는데 egress 정규식이 못 잡는 시나리오(이 PR 이 "원리적으로 없다"고 주장하는 바로 그 실패 모드)를 재현했을 때 전체 테스트 스위트가 조용히 초록으로 유지되는 것을 직접 확인했다. 이는 향후 `DEFAULT_SENSITIVE_KEYS` 확장(이 파일 자신의 관례가 예정하는 정상적 유지보수) 시 시크릿 유출을 막지 못할 수 있는 살아있는 안전성 결함이며, 이번 라운드의 보안 Rationale 재작성(R-5) 근거 자체를 약화시키므로 CRITICAL 로 분류한다.

## 위험도

HIGH
