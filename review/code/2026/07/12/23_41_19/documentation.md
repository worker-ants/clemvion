# 문서화(Documentation) 리뷰

대상: `codebase/backend/Dockerfile`(주석 정밀화), `plan/in-progress/pnpm-migration-followups.md`(§1 완료 기록 스코프 정직화 + 후속 등재, §2 조사 기록), `review/code/2026/07/12/23_21_17/*`(직전 라운드 리뷰 산출물 신규 커밋).

## 발견사항

- **[INFO]** Dockerfile 주석 정정(I2)이 실제 코드와 정확히 일치 — 검증 완료, 긍정 관찰
  - 위치: `codebase/backend/Dockerfile` `prod-deps` 스테이지 주석 (`# 내부 패키지 prepare 는 [ -d dist ] || tsc 가드라 dist 가 이미 있으면 tsc 를 스킵`)
  - 상세: `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary}/package.json` 의 `prepare` 스크립트를 직접 확인한 결과 4곳 모두 `"prepare": "[ -d dist ] || tsc"` 로 주석의 서술과 정확히 일치한다(backend 의 실제 workspace 의존 패키지는 이 4개뿐 — `sdk`/`web-chat-sdk` 는 미포함이며 실제로도 이 두 패키지는 다른 형태의 동등 가드를 씀). 또한 이 diff 는 `git show f53765bfb -- codebase/backend/Dockerfile` 로 확인 시 **주석 3줄만** 바뀐 순수 comment-only 커밋으로, RESOLUTION.md 의 "로직 무변경" 주장과 일치한다.
  - 제안: 없음(검증 확인).

- **[INFO]** `CI=true` 근거 주석의 미검증 부정확 가능성이 이번 라운드에도 그대로 잔존(직전 라운드 requirement-reviewer 가 이미 지적한 INFO, 미조치)
  - 위치: `codebase/backend/Dockerfile` `prod-deps` 스테이지 — `# 비대화형 빌드라 removal 확인 프롬프트를 넘기려 CI=true 를 준다.`
  - 상세: 이번 커밋(`f53765bfb`)은 같은 주석 블록의 바로 위 두 줄(tsc 가드 설명)만 정밀화했고, 이 줄은 원 커밋(`6053ff281`)때부터 문구가 전혀 바뀌지 않았다. 직전 라운드 `requirement.md` 가 이미 "이 근거가 pnpm 문서·실측으로 확인되지 않는다"(INFO, 선택 조치)로 지적했고 RESOLUTION.md 의 조치 목록(I2 만 정정, I1/I3/I5~I11 조치 불요)에는 이 항목이 별도로 다뤄지지 않았다 — 누락인지 "조치 불요"로 암묵 흡수한 것인지 RESOLUTION 문면상 불명확하다. `CI=true` 자체의 유해성은 없으나(Docker `RUN` 은 non-TTY 라 안전망), 특정 인과관계("removal 확인 프롬프트 회피")를 단정하는 주석이 검증되지 않은 채 남아 있다.
  - 제안: 차단 사유는 아님(INFO). 이번 fix 커밋의 스코프가 아니었을 뿐이므로 재조치를 요구하지 않되, 다음에 이 블록을 다시 손댈 때 "안전을 위한 방어적 설정" 등으로 표현을 완화하거나 근거를 pnpm 실제 동작(예: `approve-builds`)으로 좁혀 쓰는 것을 권장. RESOLUTION 이 "I2 만 정정, 나머지는 조치 불요"로 명시했으므로 새로운 결함이라기보다 스코프 확인 차원의 참고.

- **[INFO]** plan 문서(`plan/in-progress/pnpm-migration-followups.md`) §1 완료 기록의 스코프 정직화 서술 — 문서화 품질 우수
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §1 (`> **스코프 정직화(ai-review 23_21_17 실측)**...`, `> **후속(별도)**...`)
  - 상세: 직전 라운드 requirement-reviewer 의 WARNING("완료" 라벨이 상위 목표 전체 달성으로 오독될 소지)을 반영해, 실제 절감분(backend 자신 devDeps 170MB)과 잔존 갭(프런트엔드 스택 ~415MB, hoisted 특성)을 명확히 구분 서술하고 후속 옵션(§3 strict 전환, 기각됐던 옵션 A 재검토, CI 스모크 가드)까지 구체적으로 등재했다. 수치(1.4GB→1.23GB, 415MB, 33%)가 RESOLUTION.md·SUMMARY.md·requirement.md 간 일관되게 인용되어 교차 정합성도 확인됨.
  - 제안: 없음(모범 사례로 판단).

- **[INFO]** §1 완료 기록의 PR 참조가 실제 PR 번호가 아닌 브랜치/작업명 placeholder (기존 지적, 재확인만)
  - 위치: `plan/in-progress/pnpm-migration-followups.md` — `**완료(2026-07-12, PR pnpm-migration-followups)**`
  - 상세: 직전 라운드 documentation.md 가 이미 지적한 사항으로 이번 라운드에도 동일하게 남아 있다. 로컬 브랜치 단계(origin 미푸시)라 의도된 임시 표기로 판단되며 새로운 결함은 아니다.
  - 제안: PR 생성 후 실제 번호로 교체 권장(선택, 낮은 우선순위) — 기존 지적과 동일.

- **[INFO]** README/CHANGELOG 갱신 불필요 — 확인 완료
  - 위치: `README.md` §Docker/Kubernetes 배포(L292-334), `codebase/backend/README.md` §Docker(L44-55), `CHANGELOG.md`
  - 상세: 두 README 모두 이미지 빌드 커맨드·역할·환경변수만 서술하고 Dockerfile 내부 스테이지 구성(`deps`/`builder`/`prod-deps`/`runner`)이나 이미지 크기를 서술하지 않으므로 이번 변경으로 stale 해지는 부분이 없다(직접 확인). `CHANGELOG.md` 최근 항목을 확인한 결과 전부 `spec/`-linked 제품·동작 변경만 기록하고 있어(웹채팅 위젯 관련 항목들), 빌드/인프라 최적화는 이 저장소 관례상 CHANGELOG 대상이 아님이 재확인된다 — 직전 라운드 판단과 일치.
  - 제안: 없음(정보성, 관례 일치 확인).

- **[INFO]** `review/code/2026/07/12/23_21_17/*` 신규 커밋 — 리뷰 산출물 자체의 문서화 이슈 없음
  - 위치: `review/code/2026/07/12/23_21_17/{SUMMARY,RESOLUTION,architecture,dependency,documentation,maintainability,performance,requirement,scope,security,side_effect,testing}.md`, `meta.json`, `_retry_state.json`
  - 상세: CLAUDE.md 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약에 맞는 위치·구조이며, RESOLUTION.md 의 조치 내역(I2 정정)이 실제 Dockerfile diff 와 대조 검증되어 정합함을 확인했다. 이들은 사용자 대상 문서가 아닌 프로세스/감사 산출물이라 독스트링·README 관점 점검 대상이 아니다.
  - 제안: 없음.

## 요약

이번 diff 는 (a) 직전 ai-review(23_21_17) 의 I2 지적(내부 패키지 `prepare` 재컴파일 서술 과장)을 반영해 Dockerfile 주석을 정밀화한 comment-only 수정과, (b) 같은 리뷰의 W1(상위 목표 부분달성)·W2(회귀 가드 부재)를 반영해 plan 문서에 스코프 정직화·후속 과제를 등재한 문서 갱신, (c) 해당 리뷰 세션의 산출물 일체를 신규 커밋하는 것으로 구성된다. 정정된 Dockerfile 주석은 실제 `package.json` `prepare` 스크립트와 대조 검증한 결과 정확했고, comment-only 성격도 git 커밋 diff 로 직접 확인됐다. plan 문서의 스코프 정직화 서술은 수치·근거가 SUMMARY/RESOLUTION/requirement 리뷰 간 일관되며 모범적인 문서화 사례로 판단한다. README/CHANGELOG 는 이번 변경 범위에서 갱신 불필요함을 재확인했다. 유일하게 이어지는 참고 사항은 `CI=true` 근거를 설명하는 주석("removal 확인 프롬프트 회피")이 직전 라운드에서 이미 미검증으로 지적됐음에도 이번 정정 커밋의 스코프 밖이라 그대로 남아 있다는 점인데, 이는 차단 사유가 아닌 INFO 수준의 선택적 개선 여지다. 전반적으로 문서화 품질은 양호하며 신규 CRITICAL/WARNING 은 없다.

## 위험도

NONE
