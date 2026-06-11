# 요구사항(Requirement) 리뷰 — spec/conventions/secret-store.md

## 발견사항

### 1. **[INFO]** SS-SE-04 요구사항 표 문구가 신규 예시 키 차단 케이스를 미포함 (동일 파일 내부 불일치)

- 위치: `spec/conventions/secret-store.md` §4 보안 요구사항 표, SS-SE-04 행 (line 174)
- 상세:
  SS-SE-04 의 현 문구는 "마스터키 미설정 / 길이 불일치 시 부팅 fail-fast" 이다.
  이번 변경(§3.3 신규 bullet + R5 Rationale)은 "예시 키(all-zero / 옛 `0123…`) 복붙 운영" 이라는
  제3의 차단 케이스를 production 부팅 가드로 추가했다. 이 케이스는 "미설정"도 아니고
  "길이 불일치"도 아니므로 SS-SE-04 의 현 설명 문구만으로는 커버가 안 된다.
  §3.3 본문·R5·auth §Rationale 에서 해당 동작이 충분히 서술됐으나, 동일 spec 파일 안에
  있는 요구사항 표(SS-SE-04)는 갱신되지 않아 자체 불일치 상태이다.
  코드 구현은 spec 기술(§3.3·R5)과 정확히 일치하고 오류가 없다 — 이는 spec 내 표현
  불일치이며 코드 버그가 아니다.
- 제안: SS-SE-04 의 설명을 "마스터키 미설정 / 길이 불일치 / 공개 예시 키(production) 시
  부팅 fail-fast" 로 갱신해 §3.3·R5 와 표현을 맞춤. `project-planner` 에 위임.

---

### 2. **[INFO]** spec §3.3 의 "옛 `0123…`" 약술과 구현 상수의 구체 값 명시 간 모호성

- 위치: `spec/conventions/secret-store.md` §3.3 line 155; `production-guards.ts` lines 45-47
- 상세:
  spec §3.3 본문이 "옛 `0123…` 예시" 라고 약술하는 반면, 구현의 `KNOWN_EXAMPLE_ENCRYPTION_KEYS`
  는 `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` (64 char) 전체 값을 등록한다.
  spec 이 full hex 값을 열거하지 않아 차단 대상 키의 확인을 코드에 의존해야 한다. 보안 결정이라
  spec 본문에서도 완전한 차단 값을 확인할 수 있으면 운영자·감사자에게 더 명확하다.
  코드 오류는 아니나 문서 완결성 측면에서 약점.
- 제안: §3.3 또는 R5 의 "현 all-zero·옛 `0123…`" 부분에 구체 64-char hex 값을 코드 블록으로
  명시하거나, `production-guards.ts` 를 단일 정보 소스(SoT)로 참조 링크를 추가하는 방법 고려.
  `project-planner` 검토.

---

## Spec Fidelity 점검 결과

| 변경 내용 | 관련 spec 위치 | 일치 여부 |
|---|---|---|
| §3.3 all-zero placeholder bullet 추가 | `secret-store.md §3.3` (직접 변경) | N/A (본 파일이 SoT) |
| §3.3 production 부팅 거부 (`assertProductionConfig`) | `1-auth.md §Rationale "Production fail-closed 가드"` (line 554-574) | 일치 |
| §R5 Rationale 신설 | `secret-store.md §Rationale` (직접 변경) | N/A |
| R5 의 크로스링크 | `1-auth.md#rationale` | 연결 유효 |

**세부 점검**:

1. spec §3.3 → `production-guards.ts` `KNOWN_EXAMPLE_ENCRYPTION_KEYS`: spec 기술의 "현 all-zero" =
   `000…000` (64 char), "옛 `0123…`" = `0123456789abcdef…` (64 char) 가 Set 에 모두 포함됨.
   일치.

2. spec §3.3 → `assertProductionConfig` 조건 (`!encryptionKey || KNOWN_EXAMPLE_ENCRYPTION_KEYS.has(encryptionKey)`):
   spec 기술의 "미설정이거나 공개 예시 키면 부팅 거부" 와 일치.

3. spec §3.3 → `assertProductionConfig` 호출 위치: spec 기술의 "`main.ts` 의 `assertProductionConfig`" 가
   `main.ts` line 50 에서 `assertProductionConfig(process.env)` 로 bootstrap 첫 단계 호출됨. 일치.

4. spec §3.3 → 환경 예외 조건: spec 기술의 "dev/test/e2e(`NODE_ENV≠production`)는 영향 없다" 가
   `production-guards.ts` line 69 `if (env.NODE_ENV !== 'production') return;` 로 구현됨. 일치.

5. spec §3.3 기존 bullet ("미설정/빈 문자열 → SecretResolver fail-fast") vs 신규 bullet (`assertProductionConfig`):
   R5 가 "빈 값만 막는 §3.3 의 SecretResolver fail-fast 를 보완" 이라고 명확히 관계를 서술해
   두 계층의 중첩이 의도적 다층 방어임을 확인. 모순 없음.

6. `.env.example` `ENCRYPTION_KEY` 값 = `0000…0000` (64 char all-zero): `KNOWN_EXAMPLE_ENCRYPTION_KEYS`
   에 등록된 현행 placeholder 와 동일. production 배포 시 즉시 차단됨 — spec 기술 의도와 일치.

7. `production-guards.spec.ts`: `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 전체를 순회하며 throw 검증,
   `NODE_ENV≠production` no-op 검증, 정상 키 통과 검증이 모두 포함됨 — spec 기술의 케이스 커버리지 충분.

---

## 요약

이번 변경은 `spec/conventions/secret-store.md §3.3` 에 production 환경의 예시 키 차단 동작을 명문화하고 R5 Rationale 로 설계 근거를 추가한 spec 갱신이다. 대응 구현(`production-guards.ts`, `main.ts`, `.env.example`, 단위 테스트)과 line-level 비교 시 차단 대상 키 목록, 가드 위치(`main.ts`), 환경 예외(non-production no-op), 다층 fail-fast 관계 모두 spec 기술과 정합한다. CRITICAL·WARNING 수준의 누락·불일치·비즈니스 로직 위반은 없다. 유일한 미완사항은 동일 파일 내 SS-SE-04 요구사항 표 문구가 신규 케이스를 아직 포함하지 않는 자체 표현 불일치(INFO)이며, 이는 코드 버그가 아닌 spec 보완 사항이다.

## 위험도

LOW
