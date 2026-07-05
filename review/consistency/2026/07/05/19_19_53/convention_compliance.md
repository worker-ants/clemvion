# 정식 규약 준수 검토 — spec-draft-cross-audit-doc-batch.md

## 발견사항

- **[INFO]** V-13 하향이 문서 frontmatter `status`/`pending_plans` 를 건드리지 않음 — 기존 선례와 정합하나 근거를 명시하면 좋음
  - target 위치: `## V-13 ... 변경 1/2/3` 및 plan frontmatter (`spec_impact` 목록)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 (status 라이프사이클), §4 build-time 가드
  - 상세: V-13 이 하향 대상으로 짚은 `spec/4-nodes/3-ai/0-common.md`(`status: implemented`)와 `spec/4-nodes/3-ai/3-information-extractor.md`(`status: implemented`)는 변경 후에도 frontmatter `status` 는 `implemented` 로 유지될 계획이며, plan 어디에도 `pending_plans:` 신설이나 `status: partial` 전환 언급이 없다. §3 정의상 `implemented` = "모든 약속 구현 완료" 인데, 캔버스 요약(§8) 을 "구현 예정(Planned)" 으로 명시하면서 문서 전체 status 는 `implemented` 로 남기는 것이 표면적으로는 §3 정의와 어긋나 보인다. 다만 실제 리포에는 **동일 패턴의 확립된 선례**가 다수 존재한다 — `spec/4-nodes/4-integration/1-http-request.md`(`status: implemented`)는 `binary` 전용 디코딩·`followRedirects`/`verifySsl` 등 여러 세부 필드를 "미구현 (Planned)" 으로 명시하면서도 문서 status 는 `implemented` 이고 `pending_plans` 도 없다. `spec/2-navigation/_layout.md`(`status: implemented`) 도 "워크플로우 에디터 모드"/"알림 설정" 을 "미구현 (Planned)" 으로 남긴 채 `implemented` 를 유지한다. 즉 이 프로젝트는 "핵심 surface 는 구현됐고 부가/세부 기능만 Planned" 인 경우 문서 status 를 `implemented` 로 유지하는 것을 사실상 허용하는 것으로 읽힌다 — 이는 §3 표의 문언(“모든 약속 구현 완료”)보다는 관행이 앞서는 지점으로, spec-impl-evidence.md 자체에 이 경계(부분 vs 세부 갭)에 대한 명시적 기준이 없다는 컨벤션 문서 쪽의 gap 이다.
  - 제안: target 변경 자체는 (기존 확립된 3건 이상의 선례와 일치하므로) 수정 불필요. 다만 규약 쪽 gap 이 반복적으로 재현되고 있으므로, `spec-impl-evidence.md` §3 에 "문서 전체가 아니라 개별 필드/섹션 단위의 Planned 표기는 status 유지와 공존 가능" 이라는 한 줄 명확화(Rationale 추가)를 project-planner 후속 과제로 남기는 것을 권장.

- **[INFO]** `1-ai-agent.md` 는 이미 `status: partial` + `pending_plans` 보유 — V-13 변경과 자연 정합
  - target 위치: `### 변경 2 — spec/4-nodes/3-ai/1-ai-agent.md §11`
  - 위반 규약: 없음 (정합 확인)
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md` 는 frontmatter 가 이미 `status: partial` 이고 `pending_plans: [ai-agent-tool-connection-rewrite.md, exec-park-durable-resume.md]` 를 보유한다. V-13 의 "⚠ 현재 미구현(Planned)" 추가는 이미 `partial` 상태인 문서에 세부 갭을 하나 더 명시하는 것뿐이라 §3 규약과 완전히 정합한다. 위 첫 항목에서 지적한 애매함은 `0-common.md`/`3-information-extractor.md`(둘 다 `implemented`) 에만 해당.
  - 제안: 없음 (참고용 기록).

- **[INFO]** V-13 "Planned" 표기 스타일이 기존 문서 관례(`⚠ **재작성 예정 (현재 제거됨)**`, `미구현 (Planned)`)와 일치
  - target 위치: `### 변경 1/2/3`
  - 위반 규약: 없음 (정합 확인)
  - 상세: target 이 제안하는 표기("(구현 예정 — ...)", "⚠ 현재 미구현(Planned): ...")는 `1-ai-agent.md` 자체에 이미 존재하는 `⚠ **도구 연결 입력 경로 — 재작성 예정 (현재 제거됨)**`, `**미구현 (Planned)**` 패턴과 형식이 일치한다. 별도의 명명 규약 위반 없음.
  - 제안: 없음.

- **[INFO]** 5개 target spec 문서 모두 Overview/본문/Rationale 3섹션 구조 기보유 — 문서 구조 규약과 충돌 없음
  - target 위치: 전체
  - 위반 규약: CLAUDE.md 문서 구조 컨벤션 (Overview/본문/Rationale)
  - 상세: `0-common.md`(§Rationale 보유), `1-ai-agent.md`(§12 Rationale), `3-information-extractor.md`(§9 Rationale), `14-execution-history.md`(`## Overview (제품 정의)` + `## Rationale`), `13-replay-rerun.md`(`## Overview (제품 정의)` + `## Rationale`) 모두 기존에 3섹션 구조를 갖추고 있다. plan 의 8개 변경은 모두 기존 섹션 내부에 각주·행·노트를 추가하는 것으로, 신규 섹션 신설이나 구조 파괴가 없다. `## Rationale` 항목 추가(변경 5)도 기존 Rationale 섹션에 신규 항목을 덧붙이는 정상 패턴.
  - 제안: 없음.

- **[INFO]** plan frontmatter 에 `started`/`owner` 부재 — spec-status-lifecycle 범위 밖이나 인접 가드 관찰
  - target 위치: plan frontmatter (`name`/`worktree`/`spec_impact` 만 존재)
  - 위반 규약: `.claude/docs/plan-lifecycle.md` §4 (`plan-frontmatter.test.ts` 대상 — top-level `plan/in-progress/*.md` 는 `worktree`/`started`(ISO)/`owner` 필수)
  - 상세: 이번 검토 스코프(spec 3섹션·Planned 마킹·spec-status-lifecycle)에 직접 속하지 않지만, target plan 자체가 `spec-impl-evidence.md` §4.2 gate 대상 파일이라 인접성이 있어 기록한다. `started`/`owner` 필드가 누락돼 있어 build-time `plan-frontmatter.test.ts` 가 걸릴 가능성이 있다(다만 pending 상태에서 아직 미검증일 수 있음).
  - 제안: developer/planner 워크플로에서 plan 을 `complete/` 로 이동하기 전에 `started`/`owner` 필드를 채울 것. 본 검토 범위 밖이므로 CRITICAL/WARNING 등급 부여는 보류.

## 요약

target plan(`spec-draft-cross-audit-doc-batch.md`)이 제안하는 8개 변경은 문서 구조(Overview/본문/Rationale 3섹션), Planned 마킹 표기 스타일(`⚠ **... (Planned)**` 패턴), cross-reference 앵커 모두 기존 spec 관례와 정합한다. 유일하게 애매한 지점은 V-13 하향 대상 중 `spec/4-nodes/3-ai/0-common.md`·`spec/4-nodes/3-ai/3-information-extractor.md` 가 `status: implemented` 를 유지한 채 특정 기능(캔버스 요약)을 "구현 예정(Planned)" 으로 명시하는 것인데, 이는 `spec-impl-evidence.md` §3 의 문언과 표면적 긴장이 있으나 `1-http-request.md`·`_layout.md` 등 리포 안에 이미 3건 이상의 동일 패턴 선례가 확립돼 있어 target 자체의 결함이라기보다 컨벤션 문서(§3)의 세부-갭 vs 전체-상태 경계가 명문화되지 않은 gap 으로 판단한다. `1-ai-agent.md`(이미 `partial`+`pending_plans`)에 대한 변경은 완전히 정합적이다. plan frontmatter `started`/`owner` 누락은 본 검토 스코프 밖이라 별도 트랙 관찰로만 남긴다. 전반적으로 CRITICAL/WARNING 급 규약 위반은 발견되지 않았다.

## 위험도

LOW
