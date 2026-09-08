# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-followups-batch-a.md`

## 검토 방법

번들 프롬프트의 `spec/2-navigation/2-trigger-list.md`·`spec/5-system/{2-api-convention,3-error-handling,14-external-interaction-api,15-chat-channel}.md`·`spec/conventions/{secret-store,swagger,error-codes,spec-impl-evidence}.md` 는 컨텍스트 예산 초과로 **본문이 생략**돼 있었다(각 문서 상단 "⚠️ 본문 생략됨" 표시). 이 checker 는 파일시스템 read 권한으로 해당 원본을 직접 열어 target 의 인용문·라인 번호·앵커 슬러그·코드 실측 주장(약 20개 항목)을 하나씩 원문·실 코드와 대조했다. 별도 명시가 없는 한 아래 발견사항은 이 직접 대조에 근거한다.

## 발견사항

- **[WARNING]** `CLAUDE.md` Skill 표에서 harness 축 갱신이 개발자 행에만 적용되고 기획자 행은 그대로 남는다
  - target 위치: A-1 "### 변경안 — 한 행이 아니라 두 행이다" (개발자 행만 갱신) + "그리고 `project-planner/SKILL.md` 「경로별 권한」 표에도 대응 행" (project-planner/SKILL.md 갱신, `CLAUDE.md` 는 미갱신)
  - 충돌 대상: `CLAUDE.md:61-67` Skill 체계 표 자체 (기획자 행), `.claude/skills/project-planner/SKILL.md:18-25` 「경로별 권한」 표
  - 상세: 현재 `CLAUDE.md` 의 Skill 표는 4개 축(`spec/**`·`plan/**`·`codebase/**`·`review/**`) 모두에서 각 역할 SKILL.md 의 「경로별 권한」 표와 1:1 대응한다(실측 — 개발자·기획자 행 모두 자기 SKILL.md 표와 정확히 일치). target 은 이 대응을 **개발자 축에서만** 유지한다 — `CLAUDE.md` 개발자 행에 "harness 실행물" 을 명시적으로 추가하면서, 같은 표의 **기획자 행은 `spec/**`, `plan/**` 그대로 둔다**. 반면 `project-planner/SKILL.md` 자신의 「경로별 권한」 표에는 `.claude/docs/**`·`.claude/skills/**/SKILL.md`·`CLAUDE.md` 를 Read/Write 로 새로 등재한다(target 이 직접 제시한 diff). 그 결과 두 문서가 갈린다 — `project-planner/SKILL.md` 는 기획자가 거버넌스 문서를 쓸 수 있다고 명시하는데, `CLAUDE.md` 최상위 표만 보면 기획자는 여전히 `spec/**`·`plan/**` 뿐이다.
    target 자신의 A-1 근거 문단(*"권한을 갖는 쪽 문서에 그 권한이 없으면 이 항목이 고치려는 결함... 을 planner 축에 그대로 재생산한다"*)이 정확히 이 패턴을 경계하고 있으나, 그 결론은 "권한을 갖는 쪽" 을 `project-planner/SKILL.md` 로만 좁혀 적용했고 `CLAUDE.md` 표 자체(사용자가 가장 먼저 참조하는 요약 표)는 배제됐다. 표 아래 신설 불릿(*"harness 는 두 축으로 갈린다... 거버넌스 문서는 project-planner"*)이 서술로는 보완하지만, 표 셀 자체는 갱신되지 않아 **표만 읽으면 여전히 빈칸**이다 — A-1 이 스스로 지적한 "역할이 자기 권한을 자기 문서에서 확인할 수 없다" 결함의 축소판이 `CLAUDE.md` 기획자 행에 남는다.
  - 제안: `CLAUDE.md` 기획자 행 쓰기 권한 셀에도 대응 문구를 추가한다 (예: `spec/**`, `plan/**`, **거버넌스 문서**(`.claude/docs/**`·`.claude/skills/**/SKILL.md`·`CLAUDE.md`)). 개발자 행과 대칭을 맞추면 두 SKILL.md 표와 `CLAUDE.md` 표 3곳이 다시 1:1 대응하게 된다.

## 검증 완료 — 문제 없음으로 확인된 주요 주장 (기록용)

target 이 인용한 다른 영역 spec 원문·코드를 직접 대조한 결과, 아래는 모두 실측과 **정확히 일치**했다(신규 결함 없음):

- `2-trigger-list.md` R-2(226-234행)의 폐기 서술, §3 하단 v1.1 폐기 인용(160행), `config.hmacSecret` 제거 서술(162행) — 원문과 일치.
- `15-chat-channel.md:610` R-CC-10 의 R-2 인용문 — 원문과 일치. `grep -rln "r-2-webhook-hmac-secret" spec/` → **1건뿐**(`15-chat-channel.md`), target 의 실측과 일치.
- `2-trigger-list.md:106` botToken 행의 "hasBotToken boolean 만" vs "마스킹 placeholder" 동시 서술 — 원문에 실제로 공존, target 이 지적한 자기모순 확인됨. `1-data-model.md §2.17.2`(643-651행)가 "본 절이 AuthConfig 마스킹 정책의 단일 진실" 이라 명시하고 있어, botToken(write-only, 다른 리소스)에 그 마스킹 규약을 차용한 것이 SoT 위반이라는 target 진단은 근거가 탄탄하다.
- `6-config.md:125` Add Config = Admin+ 전용, 앵커 `#권한` 유일 — target 의 A-2-3 인용과 일치.
- `1-auth.md §3.2`(374행) Trigger 행 `Owner/Admin/Editor=CRUD, Viewer=R` — target 의 `2-trigger-list.md §4.1` 권한표(viewer 불가/editor+가능)와 정합.
- `2-api-convention.md §5.4` "그 자리를 두 검증자가 나눠 맡는다"(227행) 및 `swagger.md:371` "두 검증자의 경계는..." — 두 곳 모두 원문 확인, target 이 고치려는 두 지점과 정확히 일치(저장소 전체에 이 문구는 이 2곳뿐).
- `user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts`/`user-secret-absence.ts`/`user-secret-absence.spec.ts` 4파일 실재 확인, glob `user-entity-exposure*.ts`(2/2) vs `user-entity-exposure-guard*.ts`(1/2) 매치 수 target 주장과 일치.
- `3-error-handling.md §1.8/§1.9`(211-232행) "도메인 spec 참조" 템플릿 — target 이 신설하려는 §1.10 포맷과 부합, 번호 충돌 없음.
- `secret-store.md:69` "노출 창은 아직 설계대로 닫혀 있지 않다", `14-external-interaction-api.md:934-936` "현재 이 컬럼은 응답에도 나간다... 미해결 결함" — 정확히 그 줄에 그 문장 존재. `codebase/backend/src/modules/triggers/triggers.service.ts:99-100,186`의 `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2` 포함) 확인 — target 이 "이미 거짓" 이라 지적한 근거가 실측과 일치.
- `1-data-model.md §2.1` User 7컬럼(`password_hash`·`two_factor_secret`·`totp_recovery_codes`·`webauthn_recovery_codes`·`email_verify_token`·`password_reset_token`·`email_change_token`) — `USER_SECRET_KEYS` 배열과 순서까지 일치. `user.entity.ts` 에 `select: false`/`@Exclude()` 0건 확인. `§2.21 WebAuthnCredential.public_key/counter`·`§2.19 Notification.background_run_id(select:false)` 대비 사례도 원문과 일치.
- `3-schedule.md` — frontmatter `status: implemented`(`pending_plans` 없음), Rationale이 `schedules.service.ts:116-123` 의 whitelist `orderBy` 구현을 실제로 서술 — target 이 "선례 주장이 틀렸다" 며 정정한 내용이 정확하다. `triggers.service.ts` 는 `qb.orderBy('t.created_at', 'DESC')` 고정(whitelist 없음) — 자매 문서 간 구현 격차 진단이 사실과 일치.
- `spec-pending-plan-existence.test.ts` — `fs.existsSync(inProgress) || fs.existsSync(complete)` 만 검사, 항목 매칭 없음 — target 의 게이트 한계 서술과 일치.
- `.claude/**` 커밋 81건(2026-06-01~) 관례 실측, `a36395f5c`·`fed994b6b` 가 `.claude/docs/**` 를 직접 고친 사실도 확인 — target 이 "이력이 그 경계를 지지하지 않는다" 고 스스로 명시한 반례가 실제로 존재.

## 요약

target 문서(`spec-draft-followups-batch-a.md`)는 6개 하위 항목(A-1~A-6)에서 인용하는 다른 영역 spec 원문·라인 번호·앵커 슬러그·코드 실측 주장을 광범위하게 직접 대조한 결과 거의 전부가 정확했다 — 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 매트릭스 축에서 **다른 spec 영역과의 직접 모순은 발견되지 않았다**. 유일한 발견은 A-1 이 harness(`​.claude/**`) 쓰기 권한을 두 축(코드/도구=developer, 거버넌스 문서=planner)으로 나누면서 이 분리를 `CLAUDE.md` Skill 표 자체에는 개발자 행에만 반영하고 기획자 행에는 반영하지 않아, `project-planner/SKILL.md` 의 새 권한 행과 `CLAUDE.md` 최상위 표 사이에 비대칭이 생긴다는 점이다(WARNING) — A-1 이 스스로 문제 삼은 "권한을 갖는 문서에 그 권한이 안 보이는" 패턴이 대상 문서 한 곳(`CLAUDE.md`)에서 재발한다. 이 외에는 target 이 인용한 실 상황 진단(§5.4 검증자 부재, `User` 7컬럼 미등재, botToken 자기모순, R-2 폐기, sort/order 미구현 등)이 모두 실측과 일치해 채택 시 다른 영역과 충돌할 위험은 낮다.

## 위험도

LOW
