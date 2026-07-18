# 정식 규약 준수 검토 — spec/7-channel-web-chat/ (2026-07-18 03:24:41)

## 검토 범위 안내

- target: `spec/7-channel-web-chat/{0-architecture,1-widget-app,2-sdk,3-auth-session,4-security,5-admin-console}.md` (+ 직접 워크트리에서 대조한 `_product-overview.md`).
- `prompt_file` 의 "정식 규약 모음" 절에는 `spec/conventions/audit-actions.md`·`cafe24-api-catalog/**` 만 포함돼 있었다 — 둘 다 web-chat 도메인과 무관해 target 이 위반할 여지가 없음만 확인하고, 실제로 이번 검토(특히 §NNN 질의)에 필요한 정식 규약은 워크트리 절대경로로 직접 Read/grep 했다: `spec/conventions/spec-impl-evidence.md`(`code:` frontmatter 스키마 SoT) · `spec/conventions/swagger.md` · `spec/conventions/error-codes.md` · `.claude/skills/project-planner/SKILL.md`(spec 문서 구조·명명 컨벤션 SoT), 그리고 저장소 전역 `§N` 표기 관례 대조를 위해 `spec/**`·`codebase/**` 를 `git -C <워크트리> grep`으로 전수 스캔했다.
- `git diff $(git merge-base origin/main HEAD)..HEAD -- spec/7-channel-web-chat/` 로 확정한 실제 변경분은 **`2-sdk.md` frontmatter `code:` 4줄 추가뿐**이다(나머지 5개 문서 + `_product-overview.md` 는 origin/main 과 바이트 단위로 동일 — `git diff --stat` 실측). 아래 검토는 이 4줄(과 그로 촉발된 코드·문서 전반의 `§NNN` 표기 정정)을 핵심으로 다루되, 오케스트레이터 요청대로 영역 전체의 구조·명명 컨벤션도 함께 확인했다.

---

## 핵심 질의 — `§NNN` 표기 (`§110` → `§3(재전송)`) 규약 부합 검증

### 변경 내용 실측

```yaml
# spec/7-channel-web-chat/2-sdk.md:4-9 (frontmatter)
code:
  - codebase/packages/web-chat-sdk/**
  # §3(재전송) `wc:boot` 재전송 계약("위젯은 **마지막** wc:boot 의 config 를 적용")의 **위젯 측** 구현.
  # 이 문서가 그 계약의 SoT 이므로 여기 증거를 건다 — 1-widget-app.md 는 재전송을 서술하지 않는다.
  - codebase/channel-web-chat/src/widget/host-bridge.ts
  - codebase/channel-web-chat/src/widget/use-widget.ts
```

`git log -p`로 이 한 줄의 이력을 재구성하면 3단계다:

1. `ca92a1b7f` — 최초 도입, `§106`(당시 대상 문단의 **줄 번호**)로 표기.
2. `d48a48aae` — 같은 PR 이 frontmatter 에 4줄을 더 넣으면서 대상 문단이 106→110행으로 밀려 `§106`→`§110` 39건 기계적 치환("자신이 인용하는 줄을 자신이 밀어낸" 자기모순 인용의 응급 수정).
3. `7386acb72`(**이번 검토 대상**) — `/consistency-check --impl-done`(19_46_54 회차) 의 `convention_compliance` WARNING(§ 아래 "선행 회차와의 관계")을 받아들여 `§110`→`§3(재전송)`(41건, 섹션 번호+조항명)으로 재정정.

### 검증 1 — 인용 대상이 실제로 `§3` 안에 있는가

`spec/7-channel-web-chat/2-sdk.md` 실측:
- L93: `## 3. host ↔ iframe postMessage 프로토콜`
- L110: `- **\`wc:boot\` 재전송(멱등 재설정)**: host 는 iframe 을 재생성하지 않고 ...`

인용 문구("재전송")가 §3 표제 아래, §3 범위 내부에 그대로 존재한다 — 내용 일치 확인. 문서의 heading 인벤토리(`grep -noE "^#{1,4} [0-9R]"`)상 `2-sdk.md` 는 `## 1`~`## 5` + `## R`(R2~R6) 까지만 존재해, 이전 `§110`/`§106` 은 애초에 대응하는 heading 이 없는 반면 `§3` 은 실재 heading 이다.

### 검증 2 — `§N(label)` 표기가 저장소 정식 규약(de facto)과 일치하는가

명문화된 단일 `spec/conventions/<file>` 조항은 없으나, `spec/**` 전역이 예외 없이 지키는 **de facto 표기 관례**를 두 갈래로 실측했다.

**(a) `§N` = 그 문서의 실제 heading 번호** (line 번호 아님) — 코드베이스 전체에서 반례 없음:
- `spec/7-channel-web-chat/1-widget-app.md:154` `[2-sdk §3 wc:boot]` — 같은 대상을 이미 정확히 인용 중.
- `spec/conventions/swagger.md` §2-5(`### 2-5. 응답 wrapping`, L232)를 `4-security.md`가 `swagger.md#2-5-응답-wrapping` 앵커로 정확히 인용.
- `spec/4-nodes/4-integration/1-http-request.md` §4(`ALLOW_PRIVATE_HOST_TARGETS` 콜아웃)를 자기 문서 안에서 `§4`로 재인용(L105).
- `spec/4-nodes/3-ai/1-ai-agent.md` §12.5(`### 12.5 ...`, L1223)를 `0-architecture.md:72`가 `AI Agent §12.5`로 정확히 인용.

**참고 — 저장소에 실재하는 "다른" `§N` 용례(줄 번호 핀)**: `naming_collision` 관점에서 선례로 인용됐던 `http-request.handler.ts:353`(`spec §105`)·`ai-turn-orchestrator.service.ts:647`(`§646`)를 직접 대조한 결과, 이들은 인용 대상 **spec 문서의 heading 번호가 아니라 그 문서의 원시 줄 번호**를 가리키는 별개 관행이었다(`execution-engine.md` L646 은 실제로 `### 5.7 노드 유형별 리트라이 정책` 근방이라 인용 취지와 무관). 즉 두 관행("§N=heading" vs "§N=line") 이 같은 글리프를 공유해 온 것이 이번 표기 혼선의 근본 원인이며, `7386acb72` 커밋 메시지도 이를 정확히 판정했다("둘 다 부분적으로 맞다 — 행번호 관행은 실재하나 **spec 문서 자기 인용 맥락**(2-sdk.md 는 heading 이 §1~§5 뿐)에서는 §110 이 없는 섹션을 가리켜 오도"). **이 두 관행 자체를 두 개의 구별된 표기로 명문화하는 것**(예: line-pin 은 `L353` 류로, heading 인용만 `§N` 유지)은 저장소 전역 규약 변경이라 본 PR 범위 밖이며, `plan/in-progress/webchat-boot-single-flight.md`(§"이월 (신규)")가 이미 project-planner 트랙으로 정확히 이월해 뒀다.

**(b) `§N(label)` 괄호 조항명 병기** — 이번 PR 이 처음 쓴 표기가 아니라 기존 spec 전역에 이미 존재하는 패턴:
- `spec/1-data-model.md:828` `§1.3(Caller 카탈로그)·§2.1(스키마/인덱스)·§4(외부 의존)`
- `spec/conventions/error-codes.md:120,127` `§5(은퇴)`·`§3(유지 예외)`·`§5(Retired codes)`
- `spec/3-workflow-editor/2-edge.md:161` `§6(컨테이너 내부 엣지 규칙)`
- `spec/5-system/4-execution-engine.md:413` `§2(아래 "waiting_for_input park")`
- `spec/5-system/1-auth.md`(피인용) `§1.4(2FA/WebAuthn)`·`§2.3(재인증)`

→ `§3(재전송)` 은 이 기존 병기 패턴을 그대로 따른다. 괄호 라벨("재전송")도 인용 대상 문단의 표제어("`wc:boot` 재전송(멱등 재설정)")를 그대로 축약한 것이라 의미 왜곡이 없다.

**(c) `code:` frontmatter 내부 `#` 주석에서의 선례** — `spec-impl-evidence.md` 는 `code:` 안에 설명 주석을 두는 것을 금지도 명문화도 하지 않지만, 실제로 이미 4개 spec 이 이 패턴을 쓰고 있으며 전부 heading 번호를 인용한다(줄 번호 사례 0건):
- `spec/2-navigation/10-auth-flow.md:8` `# §7.2 로그인 후 ...` (실제 `### 7.2 로그인 후 리다이렉트`, L442 와 일치)
- `spec/2-navigation/9-user-profile.md:7` `# §3 이 약속하는 ...` (실제 `## 3. 워크스페이스 전환`, L154 와 일치)
- `spec/2-navigation/11-error-empty-states.md:11`, `spec/2-navigation/_layout.md:8` 도 동일 패턴.

→ `2-sdk.md` 의 신규 주석은 이 기존 "code: 내부 heading 인용 주석" 관행과도 형식이 일치한다.

### 검증 3 — 정정이 전 사용처에 일관 전파됐는가 (잔존 drift 여부)

```
$ grep -rn "§106\|§110" --include="*.ts" --include="*.tsx" --include="*.md" . | grep -v node_modules
→ plan/in-progress/webchat-boot-single-flight.md, review/code/**  (모두 "정정 이력"을 서술하는 문서 — 살아있는 인용 아님)
```

실제 코드/스펙 인용처(`spec/7-channel-web-chat/2-sdk.md`, `codebase/channel-web-chat/src/widget/use-widget.ts`, `use-widget-eager-start.test.ts`, `CHANGELOG.md`)에는 `§106`/`§110` 잔존이 **0건**이고, `§3(재전송)` 로 108건(저장소 전체, review 산출물 포함) 이상 일관 전파돼 있다. YAML 파서로 frontmatter 를 직접 파싱해 `code:` 3-entry 배열이 주석과 무관하게 정상 파싱됨과, 신규 경로 2개(`host-bridge.ts`/`use-widget.ts`) 가 실제로 존재함(`spec-code-paths.test.ts` 요건 충족)도 확인했다.

### 판정

**`§NNN` → `§3(재전송)` 정정은 저장소 정식 규약(de facto)에 완전히 부합하며, 위반 사항 없음.** 이 정정은 선행 검토 회차(`review/consistency/2026/07/17/19_46_54/convention_compliance.md`)가 남긴 WARNING("`§110` 이 실재하지 않는 section 을 가리켜 `§N`=heading 관례와 충돌, `§3` 로 정정 권고")을 **정확히 해소**했을 뿐 아니라, 그 회차가 권고한 단순 `§3` 보다 한 단계 더 정밀한 — 그리고 이미 spec 전역에 선례가 있는 — `§N(label)` 형식을 채택해 §3 내부의 여러 하위 항목(§3 은 `wc:boot`/`wc:command`/`wc:ready`/`wc:resize`/`wc:event`/`resetSession`/재전송/호스트 처리/코너 고정 등 다수 프로토콜 항목을 담은 넓은 섹션) 중 정확히 어느 조항을 가리키는지 모호성 없이 특정한다.

---

## 발견사항

- **[INFO]** `§N` 표기 규약이 아직 `spec/conventions/**` 에 명문화되어 있지 않음 (반복 drift 의 근본 원인 미제거)
  - target 위치: `spec/conventions/spec-impl-evidence.md`(`code:` 필드 스키마 SoT, §2) — 이 문서가 `code:` 필드 자체의 SoT 이지만 내부 `#` 주석의 인용 표기 규칙은 다루지 않는다.
  - 위반 규약: 없음(명문 규약 부재 자체가 사안) — 다만 위에서 실측한 대로 `spec/**` 전역이 예외 없이 지키는 de facto 관례(`§N`=heading, 필요시 `§N(label)`)가 존재한다.
  - 상세: 이번 건은 같은 조항 하나가 `§106`→`§110`→`§3(재전송)` 로 **3번 정정**됐다 — 매번 "spec 자기인용 줄이 spec 자신의 편집으로 밀린다"는 동일 구조적 취약성이 재발했다. `plan/in-progress/webchat-boot-single-flight.md`(§"이월 (신규)")가 이미 이를 "`§NNN` 행-번호 clause-id 가 구조적으로 취약 … 안정적 앵커 도입은 저장소 전역 규약 변경이라 planner 트랙"으로 정확히 이월해 뒀고, 19_46_54 회차도 동일 권고(규약 문서화)를 냈다. 이번 PR 은 (a) 즉시 수정(§3(재전송) 정정)만 반영했고 (b) 규약 문서화는 의도적으로 범위 밖에 뒀다 — `git diff origin/main..HEAD -- spec/conventions/` 가 빈 결과인 것으로 확인.
  - 제안: 이 PR 을 막을 사유는 아니다(이미 planner 트랙으로 추적 중, developer 역할은 `spec/` 비-frontmatter 본문 개정 권한이 없음). 후속 project-planner 작업에서 `spec-impl-evidence.md` §2(Frontmatter 스키마) 또는 신규 절에 "spec 조항 인용은 `§<heading-number>[(짧은 라벨)]` 만 쓰고, 문서 내 원시 줄 번호를 clause-id 로 재사용하지 않는다"는 한 줄을 명문화하면 이번과 같은 반복 drift 를 예방할 수 있다.

- **[INFO]** 영역 개요(`_product-overview.md`) 헤더 백링크가 6개 문서 중 일부에만 존재 (이번 PR 무관, 선행 회차 재확인)
  - target 위치: `1-widget-app.md`·`2-sdk.md`·`3-auth-session.md` 헤더 blockquote (`_product-overview.md` 링크 없음) vs `0-architecture.md:55`·`5-admin-console.md`(헤더에 `> 영역 개요: [_product-overview](./_product-overview.md).` 포함)
  - 위반 규약: 명시적 규약 없음 — `spec-area-index.test.ts`(SoT: `spec-impl-evidence.md §4.2`)는 index 문서가 모든 sibling 을 링크할 것만 요구하고 역방향은 요구하지 않는다. `_product-overview.md` 자체는 6개 문서를 전부 링크해 그 가드는 통과.
  - 상세: 이번 PR 의 diff 범위(`2-sdk.md` frontmatter 4줄) 밖의 순수 기존 상태이며, 19_46_54 회차가 이미 동일하게 INFO 로 기록한 항목이 이번 diff 로 인해 변하지 않고 그대로 재확인됐다(스타일 통일 제안, 규약 위반 아님).
  - 제안: 조치 불요(우선순위 낮음). project-planner 가 문서 전반을 손댈 기회가 있을 때 헤더 blockquote 패턴을 6개 문서에 통일하면 좋다.

---

## 점검했으나 위반 없음으로 확인된 항목 (근거)

- **문서 구조(Overview/본문/Rationale)**: `0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·`3-auth-session.md`·`4-security.md`·`5-admin-console.md` 전부 `## Overview` → 번호 섹션 → `## Rationale` 3단 구성 유지(project-planner SKILL.md §Spec 문서 구조와 일치). `_product-overview.md` 는 다중-spec 영역의 제품 정의 분리 파일 역할이라 별도 `## Overview` 하위헤딩 없이 본문 전체가 그 역할을 하고 말미에 `## Rationale` 을 둔 것도 SKILL.md 명명 컨벤션("다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일")과 일치.
- **명명 컨벤션**: `_product-overview.md`(밑줄 prefix, frontmatter 없음 — `spec-impl-evidence.md §1` 제외 대상과 일치) · `0-architecture.md`(`0-` prefix, 단 SKILL.md 표기는 `0-overview.md` 이나 이 영역은 `0-architecture.md`로 더 구체적인 basename 을 쓰고 있음 — frontmatter 는 정식 보유(`id`/`status`/`code`)라 "면제 대상 overview" 부류와는 다른, 추적되는 정식 spec 이며 이번 PR 과 무관한 기존 상태) · `1`~`5-name.md`(정렬 보장 상세 spec) 모두 규약과 일치.
- **frontmatter id 충돌 회피**: `4-security.md` 의 `id: web-chat-security`(basename `4-security` 와 의도적 불일치, 타 영역 동명 슬러그 충돌 회피 — `spec-impl-evidence.md §2.1` "후발 문서가 영역 prefix 로 충돌 회피" 규칙과 일치, 문서 자체에 그 사유가 명시돼 있음).
- **API 문서(swagger) 인용**: `4-security.md` 의 `swagger.md#2-5-응답-wrapping` 앵커가 실제 heading(`### 2-5. 응답 wrapping`)과 슬러그까지 정확히 일치.
- **에러 코드 명명**: 본 영역이 참조/발행하는 `WEBCHAT_IDLE_TIMEOUT`·`EXECUTION_NOT_FOUND`·`HTTP_BLOCKED`·`GENERIC_ERROR_MESSAGE` 등은 `error-codes.md` 의 `UPPER_SNAKE_CASE` + 도메인 prefix(`WEBCHAT_*`) 권장 패턴을 따름.
- **naming_collision 결과와의 정합**: 같은 세션의 `naming_collision.md`(위험도 NONE)가 이번 diff(코드 전체 범위)에서 신규 식별자 충돌 0건으로 결론지어, 본 검토(§NNN 표기 규약 부합)와 상충하는 지점이 없다 — 이전 회차(19_46_54)와 달리 이번 회차는 두 checker 간 충돌이 재발하지 않았다.

---

## 요약

이번 PR 의 `spec/7-channel-web-chat/` 변경분은 `2-sdk.md` frontmatter `code:` 블록에 주석 2줄 + 경로 2줄을 추가한 것이 전부이며, 그 핵심은 선행 검토 회차가 WARNING 으로 지적했던 `§110`(대응 heading 없는 줄-번호 핀) 을 `§3(재전송)`(실제 heading + 조항명)으로 정정한 것이다. 직접 워크트리에서 heading 인벤토리·기존 인용 선례(`§N(label)` 병기 패턴 5건, `code:` 내부 heading-인용 주석 선례 4건)를 전수 대조한 결과, 이 정정은 저장소 전역 spec 이 예외 없이 지키는 `§N=heading` de facto 관례를 정확히 복원하며, 인용 내용도 실제 §3 본문("`wc:boot` 재전송(멱등 재설정)")과 정확히 일치한다. 잔존 `§106`/`§110` 은 정정 이력을 서술하는 plan/review 문서에만 남아 있고 살아있는 인용부(spec·코드·CHANGELOG)에는 0건이다. `_product-overview.md` 헤더 백링크 비일관 1건은 이번 PR 과 무관한 기존 상태로 재확인만 했고, "§N 표기 규약을 `spec/conventions/`에 명문화하라"는 근본 권고는 이미 project-planner 트랙(plan 문서의 "이월 (신규)" 절)으로 정확히 이월돼 있어 이번 PR 을 막을 사유가 되지 않는다. CRITICAL/WARNING 없음, INFO 2건(둘 다 조치 불요/저우선순위 제안).

## 위험도

NONE
