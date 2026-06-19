# 보안(Security) 리뷰

## 발견사항

- **[INFO]** nodemailer ^8.0.4 → ^9.0.1 메이저 업그레이드 (raw 옵션 파일 읽기·SSRF CVE 해소)
  - 위치: `codebase/backend/package.json` L96
  - 상세: nodemailer <=9.0.0 에서 `raw` 옵션을 통해 로컬 파일을 첨부 메일로 읽어들이거나 SSRF 를 유발할 수 있는 취약점이 존재했다. 9.0.1 로 상향하여 해소한 것은 적절하다. 또한 `overrides` 에 `"nodemailer": "^9.0.1"` 을 추가해 preview-email/mailparser 가 끌어오는 중첩 사본(nodemailer@8)까지 강제 치환한 점이 올바른 처리다.
  - 제안: 현재 대응은 충분하다. 런타임에서 nodemailer 버전을 한 번 더 확인(`npm ls nodemailer`)하여 8.x 사본이 남아있지 않은지 검증하면 좋다.

- **[INFO]** dompurify 3.4.2 → 3.4.11 (XSS 패치 반영)
  - 위치: `codebase/frontend/package.json` L45, `codebase/channel-web-chat/package.json` L14
  - 상세: dompurify 3.4.2~3.4.10 구간에 XSS 허용 우회 취약점이 보고되었다. frontend 와 channel-web-chat 모두 3.4.11 로 패치된 것은 올바른 처리다. channel-web-chat 은 exact-pin 정책을 유지하며 `3.4.11`(고정)으로 선언한 점도 공급망 무결성 측면에서 적절하다.
  - 제안: 현재 대응은 충분하다.

- **[INFO]** ws ^8.20.1 → ^8.21.0 (DoS 패치)
  - 위치: backend `overrides`, frontend `overrides`
  - 상세: ws 8.20.1 이하에서 HTTP 요청 헤더 파싱을 통한 DoS 취약점이 있었다. 양 패키지에서 overrides 를 통해 8.21.0 으로 강제 치환한 것은 적절하다.
  - 제안: 현재 대응은 충분하다.

- **[INFO]** multer ^2.2.0 (DoS 패치)
  - 위치: `codebase/backend/package.json` overrides
  - 상세: 이전 버전 multer 에서 멀티파트 업로드 파싱 시 DoS 취약점이 있었다. override 로 2.2.0 이상 강제한 것은 적절하다.
  - 제안: 현재 대응은 충분하다.

- **[INFO]** form-data ^4.0.6 (CRLF 인젝션 패치)
  - 위치: backend/frontend overrides
  - 상세: form-data 4.0.5 이하에서 CRLF 인젝션 취약점이 보고되었다. 4.0.6 으로 override 한 것은 적절하다.
  - 제안: 현재 대응은 충분하다.

- **[INFO]** undici ^7.28.0 (TLS 검증 우회 패치)
  - 위치: `codebase/frontend/package.json` overrides
  - 상세: undici 이전 버전에서 TLS 인증서 검증을 우회할 수 있는 취약점이 존재했다. 7.28.0 으로 override 한 것은 적절하다.
  - 제안: 현재 대응은 충분하다.

- **[INFO]** @grpc/grpc-js 1.14.3 → 1.14.4 (보안 픽스)
  - 위치: `codebase/backend/package.json` overrides
  - 상세: grpc-js 1.14.4 는 이전 버전 대비 보안 패치를 포함한다. override 로 강제 치환한 것은 적절하다.
  - 제안: 현재 대응은 충분하다.

- **[INFO]** protobufjs ^7.5.6 → ^7.6.3 (보안 패치)
  - 위치: `codebase/backend/package.json` overrides
  - 상세: protobufjs 의 이전 버전에서 알려진 취약점(Prototype Pollution 등)이 있었다. 7.6.3 으로 상향한 것은 적절하다.
  - 제안: 현재 대응은 충분하다.

- **[INFO]** js-yaml moderate 취약점 미패치 (의도적 accept)
  - 위치: CHANGELOG.md 잔여(accept) 항목
  - 상세: gray-matter@4 가 js-yaml 3.x `safeLoad` API 에 묶여 forward 가 불가하다고 명시되어 있다. 해당 취약점(merge-key DoS)은 빌드 타임 신뢰 입력(자체 docs frontmatter)만 파싱하므로 실위험이 낮다는 근거가 기재되어 있다. 그러나 이 판단이 완전히 정확하려면 다음 조건이 충족되어야 한다: (1) gray-matter 로 파싱하는 소스가 외부 사용자 입력을 전혀 포함하지 않을 것, (2) 빌드 파이프라인 자체가 외부 입력을 주입할 여지가 없을 것.
  - 제안: gray-matter 파싱 경로에서 사용자 또는 외부 네트워크 입력이 절대 유입되지 않음을 코드 레벨에서 재확인할 것을 권고한다. 확인이 되었다면 현재 accept 결정은 합리적이다.

- **[INFO]** `//security-overrides` 코멘트 키를 package.json 에 삽입
  - 위치: `codebase/backend/package.json` L104, `codebase/frontend/package.json` L83
  - 상세: JSON 에 `//` 키를 사용하는 것은 npm 에서 비공식적으로 허용되는 관행이나, 일부 도구(파서)에서 예상치 못한 동작을 유발할 수 있다. 보안상 직접적 위험은 없으나 주석 내 민감 정보가 없는지 확인이 필요하다. 현재 삽입된 내용은 취약점 대응 근거로 민감 정보를 포함하지 않으므로 문제없다.
  - 제안: 현재 내용은 안전하다. 추후 이 필드에 내부 인프라 정보(IP, 엔드포인트 등)가 기술되지 않도록 주의한다.

- **[INFO]** vite ^8.0.16 override (frontend)
  - 위치: `codebase/frontend/package.json` overrides
  - 상세: vite 에서 알려진 취약점을 해소하기 위해 8.0.16 이상으로 강제하였다. vite 는 빌드 도구이므로 런타임 노출은 없으나 공급망 공격 벡터가 될 수 있다. 패치 적용은 적절하다.
  - 제안: 현재 대응은 충분하다.

## 요약

이번 변경은 소스 코드 수정 없이 `npm audit` 에서 검출된 high/critical 취약점을 직접 의존성 업그레이드 및 `overrides` 강제 핀으로 해소한 의존성 보안 작업이다. nodemailer(SSRF/파일 읽기), dompurify(XSS), ws/multer(DoS), form-data(CRLF 인젝션), undici(TLS 검증 우회), grpc-js/protobufjs(보안 픽스) 등 명확한 CVE/취약점을 대상으로 한 정확한 대응이 이루어졌으며, 하드코딩된 시크릿, 인증/인가 우회, 에러 처리 문제, 인젝션 취약점 등 여타 보안 항목은 이번 변경 범위에 포함되지 않는다. 잔여 accept 항목(js-yaml moderate)에 대해 명시적 근거가 기재된 점도 긍정적이나, gray-matter 파싱 경로에 외부 입력이 절대 유입되지 않는다는 점을 코드 레벨에서 재확인할 것을 권고한다. 전반적으로 이번 패치는 의존성 보안 개선을 위한 적절하고 범위가 잘 통제된 변경이다.

## 위험도

LOW
