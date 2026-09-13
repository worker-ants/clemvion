# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트에서 diff 가 생략된 파일(3~6, 8~9, 11~12, 24~44)은 워크트리에서 직접 열람했고,
`git diff origin/main...HEAD --stat` 로 전체 44개 변경 파일을 프롬프트의 파일 목록과 대조했다
(일치 확인). 저장소는 뮤테이션하지 않았다(`git status --short` — `review/**` untracked 산출물 외
변경 없음).

## 발견사항

- **[INFO]** 이번 diff 는 코드 변경(가드 리네임·확장)뿐 아니라 **같은 세션의 두 이전 리뷰
  라운드(`--impl-prep` 12_33_41 · `/ai-review` 14_41_14) 및 후속 `--impl-done` 14_41_43** 산출물
  전부(30여 개 `.md`/`.json`)와 그 `RESOLUTION.md` 를 함께 커밋한다.
  - 위치: `review/code/2026/09/13/14_41_14/*`, `review/consistency/2026/09/13/12_33_41/*`,
    `review/consistency/2026/09/13/14_41_43/*` (프롬프트 파일 10~44)
  - 상세: 얼핏 보면 "코드 하나 리네임하는데 diff 가 44개 파일"이 스코프 크리프처럼 보일 수
    있으나, `review/` 는 `.gitignore` 대상이 아니고(`CLAUDE.md` 저장 위치 표 · 사용자 메모
    "review/ 는 gitignored 아님") 이 저장소의 확립된 워크플로가 "구현 → `/ai-review`/
    `--impl-prep`/`--impl-done` → RESOLUTION → 한 커밋" 이다. RESOLUTION.md 두 건 모두 이번
    diff 의 실제 코드 변경(가드 파일 3~6·7·CHANGELOG·PROJECT.md)이 그 라운드가 지적한
    WARNING 을 정확히 그 지적 범위 안에서 고쳤음을 실측으로 확인했다(예:
    `guide-sanitized-message-parity.test.ts:16` 크로스레퍼런스 정정, `composeTexts` 필터
    `docker-compose*.yml` 로 좁힘, "지우지 말 것" 한계 주석 복원 — 전부 diff 로 직접 대조).
    즉 44개 파일 중 진짜 "코드"는 소수(가드 2쌍 교체 + 자매 파일 2줄 + 문서 2줄)이고 나머지는
    그 코드 변경을 감사하는 산출물이다.
  - 제안: 조치 불요. 다만 다음 스코프 리뷰어를 위해 기록 — 이런 패턴(리뷰 산출물이 diff 파일
    목록에 대량으로 나타남)을 볼 때는 "무관한 파일 추가"로 오판하기 전에 그 산출물이 같은
    작업의 리뷰 이력인지 먼저 확인할 것.

- **[INFO]** 트래커 파일(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 이번
  작업과 무관한 신규 백로그 항목 1건이 추가됨 — 단, 명시적으로 "무관"이라고 표시됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`cafe24-api-metadata.md
    §4` Principle 7→0 오인용 항목, `--impl-prep` convention_compliance WARNING#4 유래)
  - 상세: `git diff origin/main...HEAD` 로 직접 대조한 결과, 이 항목은 이번 PR 의 목적(식별자
    가드 리네임/확장)과 완전히 별개인 spec 오인용 결함이다. 다만 이 저장소 관례상 developer 는
    `spec/` 쓰기 권한이 없어 발견 즉시 `plan/` 백로그로 등재해야 하며(`CLAUDE.md` §Skill 체계),
    항목 자체에 `"#1331 과 무관한 선재 결함이고 spec/** 이라 developer 권한 밖"` 이라고 스스로
    명시해 은폐 없이 투명하게 처리했다. 이전 라운드(`14_41_14/scope.md`)도 같은 결론(INFO,
    조치 불요)에 도달했고, 이번 라운드에서도 그 항목의 내용·처분이 변경되지 않았음을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** 가드 파일 교체가 `git mv` 가 아니라 delete+create 로 이뤄져 있어 파일 이력이
  끊긴다(이전 라운드에서 이미 지적·수용된 사항, 이번 라운드에서 변경 없음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`/
    `guide-error-code-scan.ts` (삭제) → `guide-identifier-existence.test.ts`/
    `guide-identifier-scan.ts` (신규)
  - 상세: `git diff origin/main...HEAD --stat` 상 두 쌍이 `deleted`/`new file` 로 각각 나타나
    rename 으로 인식되지 않는다. 다만 축 구조(3축→3축이나 축 정의·문맥 게이팅 자체가 제거)와
    허용목록 도입까지 포함된 실질적 재설계라 순수 리네임이 아니었다는 점은 타당하고, 직전
    RESOLUTION.md(`review/code/2026/09/13/14_41_14/RESOLUTION.md` INFO#9)가 "다음에 리네임+
    재작성이 겹치면 두 커밋으로 나눌 것"을 이미 후속 교훈으로 명시했다 — 새로 지적할 내용은
    없다.
  - 제안: 조치 불요(회고적 조치는 이력 재작성 비용이 이익보다 큼).

- **[INFO]** 이번 diff 의 실질 코드 변경은 목적(가이드 식별자 실재성 가드 확장)에 정확히
  국한되며, 요청 이상의 리팩토링·기능 확장·포맷팅 혼입·불필요한 임포트/주석/설정 변경은
  관찰되지 않았다
  - 위치: `git diff origin/main...HEAD --stat` 전체 (44 파일 중 애플리케이션/테스트 코드는
    `guide-error-code-*`↔`guide-identifier-*` 4파일 + `guide-sanitized-message-parity.test.ts`
    2줄뿐)
  - 상세: 직접 diff 를 읽은 결과 신규 스캐너(`guide-identifier-scan.ts`)·테스트
    (`guide-identifier-existence.test.ts`)는 옛 파일(`guide-error-code-*`)의 문맥-게이팅 로직
    (`TABLE_HEADER_WITH_CODE`/`codeTableRows`/`CODE_CONTEXT`)을 걷어내고 백틱 전수 축 + 환경변수
    수집기 + 외부 어휘 허용목록으로 교체한 것으로, plan 문서(§A~D)가 실측(뮤테이션·grep)으로
    정당화한 설계 변경 범위 안에 있다. `package.json`/lockfile 변경 없음, 신규 외부 의존성 0건
    (다른 리뷰어의 dependency.md 와 일치), production 코드(`codebase/backend/src`,
    `codebase/frontend/src` 의 non-test 코드) 변경 0건.
  - 제안: 없음.

## 요약

핵심 변경(가드 리네임 `guide-error-code-*`→`guide-identifier-*`, 환경변수 축 추가, 외부 어휘
허용목록 4강제 도입, `CHANGELOG.md`/`PROJECT.md`/자매 테스트 파일의 참조 갱신, 두 개의
`plan/in-progress/*.md` 트래커 갱신)은 트래커 항목 하나("가이드가 적는 식별자가 실재하는지 세는
가드가 없다")를 닫는 단일 목적에 정확히 수렴하며, 실제 애플리케이션 코드는 전혀 건드리지 않았다.
diff 에 함께 포함된 다수의 `review/code/**`·`review/consistency/**` 파일은 무관한 산출물이
아니라 이 프로젝트가 명문화한 "구현 완료 후 `/ai-review`/`--impl-prep`/`--impl-done` → RESOLUTION
→ 한 커밋" 워크플로의 정상 산물이며, 실제로 그 RESOLUTION 이 주장하는 수정 사항(자매 파일
크로스레퍼런스, compose 파일 필터 축소, 한계 주석 복원)이 코드 diff 에 정확히 반영돼 있음을
직접 대조했다. 트래커에 추가된 `cafe24-api-metadata.md` 오인용 항목은 이번 작업과 무관하지만
프로젝트 관례("발견 즉시 등재")를 따른 것이고 스스로 "무관"이라 명시해 은폐성이 없다. 이전
라운드의 scope 리뷰가 지적한 두 INFO(자매 참조 drift는 이미 해소, git mv 미사용)는 그대로
INFO 수준을 유지하며 새로운 스코프 위반은 발견되지 않았다.

## 위험도

NONE
