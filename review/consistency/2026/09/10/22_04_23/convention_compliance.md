# 정식 규약 준수 검토 — telegram signing carve-out spec draft

target: `plan/in-progress/spec-draft-telegram-signing-carveout.md` (검토 모드: `--spec`)

## 발견사항

- **[WARNING]** §5.4.1.1 제목이 "slack / discord 한정"인데 변경안 A 가 그 표에 telegram 행을 넣는다
  - target 위치: 변경안 표 **A** 행 (`15-chat-channel.md` §5.4.1.1)
  - 위반 규약: 문서 구조 규약 (CLAUDE.md 의 spec 문서 구성 원칙 — 제목이 본문 스코프를 정확히 고지해야 함). `spec/conventions/chat-channel-adapter.md §2.3` 자체는 `inboundSigningRef` 를 "provider 무관 단일 슬롯"으로 정의하지만, `15-chat-channel.md` 의 **절 제목**은 명시적으로 "(slack / discord 한정 — v1 차단)" 이다
  - 상세: 현재 `#### 5.4.1.1 \`inboundSigning\` PATCH 정책 (slack / discord 한정 — v1 차단)` (`spec/5-system/15-chat-channel.md:384`) 은 절 제목 자체가 스코프를 "slack/discord" 로 한정한다. 변경안 A 는 바로 이 표에 telegram 행을 추가해 *"`setupChannel()` 재호출마다 재발급·재저장된다"* 를 적으려 하는데, telegram 의 동작은 "v1 차단"이 아니라 정반대(계속 재발급·재저장)다. 표 안에 telegram 행이 들어가는 순간 절 제목의 "slack / discord 한정" 문구가 그 표의 실제 내용과 어긋난다 — 독자가 제목만 보고 "이 표는 slack/discord 얘기"라고 판단하면 telegram 행을 놓치거나, telegram 도 "v1 차단" 대상이라고 오독할 위험이 있다. draft 의 "A 의 자리를 옮겼다 (1R WARNING)" 메모는 표의 위치(§5.4.1 vs §5.4.1.1)는 재검토했지만 **제목 문구 자체의 정합성**은 다루지 않았다
  - 제안: 변경안 A 실행 시 절 제목도 함께 갱신 (예: "`inboundSigning` PATCH 정책 + telegram 발급 방식 (slack/discord PATCH 차단 · telegram 은 server-issued carve-out)" 등) 하거나, telegram 행을 표 안에 섞는 대신 표 아래 별도 소단락으로 분리해 "PATCH 차단(slack/discord)"과 "지속 재발급(telegram)"이라는 서로 다른 규범을 시각적으로 갈라야 한다. 이 지시를 변경안 A 항목 설명에 명시적으로 추가할 것을 제안

- **[WARNING]** 변경안 B가 "「기각한 대안」 신설"이라고 하지만 R-CC-21 에는 이미 동명 subsection 이 있다
  - target 위치: 변경안 표 **B** 행 (`15-chat-channel.md` `### R-CC-21`)
  - 위반 규약: 문서 구조 규약 — 동일 spec 문서 내 heading 중복은 GitHub-flavored anchor 를 `#기각한-대안` → `#기각한-대안-1` 로 분기시켜 앵커의 유일성을 깨뜨린다. `spec/5-system/15-chat-channel.md` 는 각 `R-CC-N` 항목마다 소제목을 재사용하지 않는 관례를 지켜왔다(`#### 기각한 대안` 은 파일 전체에서 R-CC-21 안에 **한 번만** 존재 — 다른 R-CC-N 항목엔 동명 소제목이 없음, `grep -n "기각한 대안" spec/5-system/15-chat-channel.md` → 1건)
  - 상세: `R-CC-21` 은 이미 `#### 기각한 대안` (line 767~772, botToken 값 가드 관련 두 대안 기각)을 갖고 있다. draft 의 변경안 B 설명 *"「telegram 은 왜 예외인가」 소절 + 「기각한 대안」 신설"* 을 문면 그대로 집행하면 **같은 R-CC-21 섹션 안에 "기각한 대안"이라는 동일 제목의 소제목이 두 번** 생긴다 — 하나는 기존 botToken 축, 하나는 신설 telegram 축. 두 목록의 주제가 다른데 제목이 같아지면 (a) 앵커가 `-1` suffix 로 갈라져 향후 교차 링크가 어느 쪽을 가리키는지 모호해지고, (b) 같은 rationale 항목 안에서 서로 다른 결정(botToken 필드 가드 vs telegram carve-out)의 "기각한 대안"이 헷갈릴 수 있다
  - 제안: 신설하지 말고 **기존 `#### 기각한 대안` 표에 telegram 관련 3개 대안(draft 본문에 이미 정리된 표)을 행으로 추가**하거나, 부득이 별도 소제목이 필요하면 `#### 기각한 대안 (telegram carve-out)` 처럼 구분되는 제목을 쓸 것

## 확인된 준수 사항 (참고 — 위반 아님)

검토 과정에서 다음은 실제로 확인했고 **위반이 아니다**:
- `issuedInboundSigning` / `inboundSigningRef` / `inboundSigningPlaintext` / `botTokenRef` 등 draft 가 쓰는 필드명은 `spec/conventions/chat-channel-adapter.md §2.3/§2.4`, `spec/conventions/secret-store.md §5.5` 의 기존 타입 정의·용어와 정확히 일치한다.
- `secret-store.md §5.5(a)` 는 이미 `setupChatChannel` 이 `result.issuedInboundSigning` 존재 시 조건 없이 `secrets.rotate()` 하는 코드를 예시로 신고 있어, draft 의 "제3의 SoT(convention)에도 blanket PATCH 서술이 없다"는 전제(4자리만 문제)와 들어맞는다 — 5번째 mirror 지점을 놓친 것이 아니다.
- draft 파일 naming (`plan/in-progress/spec-draft-telegram-signing-carveout.md`) 은 기존 `spec-draft-*.md` 선례(`spec-draft-eia-62-waiting-payload.md` 등)와 일치하고, frontmatter 의 `spec_impact` 는 리스트 형식(Gate C) 을 준수한다.
- `ChatChannelPatchConfigDto` 명명 회피 결정은 draft 스스로 "저장소에 `Patch` 접두 클래스 0건" 을 실측 근거로 들었고 `naming_collision` 축 관할로 명시 위임했다 — 적절한 스코프 판단이다.
- `R-CC-N` prefix 컨벤션(`15-chat-channel.md` "Rationale ID 컨벤션" 절, line 608~610)은 "본 절 **신규 항목**"에만 새 ID 를 요구하는데, draft 의 telegram carve-out 은 R-CC-21 을 번복하지 않는 **동일 결정의 스코프 좁히기**(D-C 에 명시)이므로 새 `R-CC-22` 를 만들지 않고 R-CC-21 을 확장하는 것이 컨벤션과 일치한다(R-CC-10 이 인라인 날짜 주석으로 확장된 선례와 동일 패턴).
- `spec/data-flow/**` 는 `spec/conventions/spec-impl-evidence.md §1` 에 의해 frontmatter 의무 대상에서 **명시적으로 제외**된다 — 변경안 C 의 대상 `data-flow/14-chat-channel.md` 가 frontmatter 를 갖지 않는 것은 컨벤션 위반이 아니다.
- `15-chat-channel.md`/`2-trigger-list.md` 의 `pending_plans:` (spec-impl-evidence.md 의무 필드) 는 "미구현 surface 를 책임지는 plan" 을 위한 것이고, 실측상 현재 목록(Discord gateway·Slack socket mode·visual SSR PNG·nullable-notation-followups)은 전부 기능 미구현 항목이다. 본 draft 는 이미 구현된 telegram 동작에 대한 **spec 텍스트 정정**이라 신규 `pending_plans` 등재 대상이 아니다 — 등재 누락이 아니다.

## 요약

target 은 spec 문서(정식 규약이 실제로 적용되는 자리)를 직접 편집하는 최종본이 아니라 그 편집을 준비하는 `plan/in-progress/` 드래프트이며, 명명(필드명·URI scheme·DTO 축)·frontmatter 스키마(`spec_impact` 리스트, `spec-draft-*` 네이밍)·Rationale ID 정책·`spec/data-flow`/`pending_plans` 의 적용 범위 등 실제로 검증 가능한 정식 규약 항목들과 대조했을 때 전반적으로 정확하고 신중하게 정합화되어 있다(특히 `chat-channel-adapter.md`·`secret-store.md` 의 기존 타입·용어를 한 글자도 어긋나지 않게 재사용한 점). 다만 draft 가 제안하는 두 변경(A, B)을 문면 그대로 spec 본문에 적용할 경우 (1) "slack/discord 한정" 이라는 절 제목 아래 telegram 행이 들어가는 제목-본문 스코프 불일치, (2) 같은 R-CC-21 rationale 항목 안에서 "기각한 대안" 소제목이 중복 생성되는 앵커 충돌 위험이라는 두 건의 **문서 구조 규약** 상 WARNING 이 남아 있어, 실제 spec 편집 단계에서 이 두 지점을 함께 처리하도록 변경안 설명에 보강이 필요하다.

## 위험도

LOW
