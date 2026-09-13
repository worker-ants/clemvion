# 문서화(Documentation) 리뷰 — guide-identifier-existence (라운드 2, `14_41_14` 이후)

## 배경

이번 diff 는 순수 신규 코드가 아니라, **직전 `/ai-review` 라운드(`14_41_14`)가 낸 WARNING 4건에 대한
수정(`fix(guards): 리뷰 라운드 1`)이 이미 커밋된 상태**를 포함한다. 따라서 이번 라운드의 문서화
검토는 (1) 전 라운드 WARNING 이 실제로 해소됐는지 소스를 직접 열어 재검증하고, (2) 그 수정 자체가
새 문서화 결함을 만들지 않았는지를 본다.

## 검증 결과 — 전 라운드 WARNING 재확인 (전부 직접 `Read`/`grep` 로 확인)

- **[해소 확인] 자매 파일 죽은 참조** — `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` 이 `"자매 \`guide-identifier-existence.test.ts\`(\`#1330\` 당시 \`guide-error-code-existence.test.ts\`)"` 로 갱신됨. `grep -rn "guide-error-code" codebase/ spec/ PROJECT.md CHANGELOG.md` 로 저장소 전체를 재확인한 결과 남은 3건은 전부 `#1330`/`#1331` 각주로 명시된 **의도적 역사 서술**(`guide-identifier-scan.ts:9`, 위 sibling 파일, `CHANGELOG.md:77`)이고 댕글링 참조는 0건.
- **[해소 확인] "존재 검사 ≠ 방출 검사" 한계 절 + "이 주석을 지우지 말 것" 지시 복원** — `guide-identifier-scan.ts:53-76` 에 해당 절이 env 축까지 일반화되어 복원됐고, 추가로 `> **그리고 실제로 지워졌다 — \`#1331\` 이 이 파일을 재작성하면서.**` 문단으로 삭제·재발견 경위 자체를 기록해 뒀다 — 같은 실패가 세 번째 재발하지 않도록 자기참조적 경고를 남긴 형태.
- **[해소 확인] `composeTexts` 과확장** — `guide-identifier-existence.test.ts:48-51` 이 `f.endsWith(".yml") || f.endsWith(".yaml")` 에서 `/^docker-compose.*\.ya?ml$/` 로 좁혀졌고, 바로 위 주석에 종전 판이 `pnpm-lock.yaml`(784KB)까지 읽었다는 실측과 "구현이 이름보다 넓었다" 는 자기 진단이 함께 남아 있다.
- **[해소 확인] CHANGELOG Unreleased 항목 drift** — `CHANGELOG.md:66-81` 이 파일명(`guide-identifier-existence`)·허용목록 도입(`GUIDE_EXTERNAL_VOCABULARY`)·"두 PR 에 걸쳐 두 번 바뀌었다" 는 번복 경위까지 반영해 갱신됨. `PROJECT.md:300` 카탈로그 문구도 동일 사실관계로 일치.
- **[해소 확인] 실제 코퍼스 명명 회귀 단언 복원** — `guide-identifier-existence.test.ts:96-106` 이 `discord.en.mdx`/`EXECUTION_TIMEOUT` 과 `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL` 두 개의 실제 파일·토큰 지정 단언으로 복원됨(라운드 1 testing WARNING#6 인용 주석 포함, 인용 정확함).

이번 라운드에서 **새로운 CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.**

## 발견사항 (INFO — 신규 아님, 이미 등재된 항목의 연속성 확인)

- **[INFO] `user-guide-evidence.md §2` SoT 미등재 갭이 여전히 열려 있음** (신규 결함 아님)
  - 위치: `spec/conventions/user-guide-evidence.md` (`guide-identifier-existence`/`guide-sanitized-message-parity` 미등재), 자칭처는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:4-5` · `guide-identifier-existence.test.ts:25-26` · `PROJECT.md:300`
  - 상세: `grep -n "guide-identifier\|guide-error-code" spec/conventions/user-guide-evidence.md` 가 0건임을 재확인했다. 이 gap 은 `--impl-prep`(`12_33_41`)·`--impl-done`(`14_41_43`) 양쪽에서 이미 WARNING 으로 잡혔고 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274` 에 파일명(리네임 반영)·Rationale 요구까지 포함해 한 항목으로 등재돼 있다. `spec/` 은 developer 쓰기 권한 밖이라 이 항목 자체는 정당하게 열려 있는 상태다.
  - 제안: 조치 불요 — planner 턴이 표·frontmatter `code:` 목록·Rationale 을 한 번에 처리하면 해소됨. 회귀 방지용 재확인 기록.

- **[INFO] Unicode `\b` 워드 경계 한국어 미성립 교훈이 코드에서 완전히 소실된 상태 유지**
  - 위치: 삭제된 `guide-error-code-scan.ts` 의 `TABLE_HEADER_WITH_CODE` (대응 코드 없음, 설계상 정당한 삭제)
  - 상세: 문맥 게이팅 축 자체가 폐기되며 이 교훈이 걸려 있던 코드도 함께 사라졌다. 라운드 1 documentation 리뷰가 이미 지적했고 RESOLUTION 에서 "낮은 우선순위, 공유 규약 문서 이관은 별건" 으로 조치 불요 처리됐다. 재발 가능성이 있는 일반적 JS 정규식 함정이라는 성격은 변하지 않았다.
  - 제안: 조치 불요 유지. 향후 유사 정규식 작성 지점(`tree-walk.ts` 등)에 한 줄 캐치롤 주석으로 옮기는 것을 권장하되 이번 PR 범위는 아니다.

- **[INFO] 설계 근거(3축 실측표·"허용목록 없음" 번복 서사)가 `guide-identifier-scan.ts` 헤더·`guide-identifier-existence.test.ts` JSDoc·`plan/in-progress/guide-identifier-existence.md` §A~D 세 곳에 거의 동일하게 반복**
  - 위치: 위 세 파일
  - 상세: 라운드 1 maintainability 리뷰가 이미 지적한 사항으로, "왜" 를 코드에 남기는 이 프로젝트의 관례상 허용 범위이나 다음 설계 변경 시 세 지점을 동기화해야 하는 비용이 존재한다(이번 PR 자체가 파일명 하나 바꾸는 데 다수 지점 동기화가 필요했던 사례).
  - 제안: 즉시 조치 불요. 다음 축 변경 시 "코드 헤더가 SoT, 테스트/plan 은 참조만" 하는 방향으로 점진적 정리를 권고.

## 요약

전 라운드(`14_41_14`)가 낸 문서화 WARNING 4건(자매 파일 죽은 참조·"지우지 말 것" 한계 주석 소실·CHANGELOG drift·명명 회귀 단언 소실) 전부를 소스 직접 열람으로 재검증한 결과 모두 정확히 처방대로 해소되어 있다. 특히 두 번째 항목(한계 주석 소실)은 단순 복원에 그치지 않고 "왜 지워졌었고 왜 다시 적는지"를 스스로 기록해 같은 실패가 세 번째로 재발하지 않게 하는 방어까지 갖췄다. 이번 라운드에서 새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다. 남은 항목(SoT 미등재, `\b` 교훈 소실)은 이미 planner 백로그에 등재됐거나 저위험으로 처분된 기존 사안의 연속성 확인일 뿐 신규 결함이 아니다.

## 위험도

LOW — 빌드/테스트에 영향 없고, 전 라운드가 지적한 "다음 사람을 오도할 수 있는" 문서 결함이 전부 실측 확인된 상태로 해소됐다. 잔존 항목은 전부 이미 별도 트랙(planner 등재 또는 조치 불요 처분)에 있다.
