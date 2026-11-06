namespace TimeSheet.Api.UnitTests.ServiceTests;

using TimeSheet.Api.Services.Security;

public class PasswordHasherTests
{
    // Empreinte produite par l'application Next.js (hash-wasm), sel 01 à 10 :
    // les comptes existants doivent rester valables après la réécriture.
    private const string FromNextJs = "$argon2id$v=19$m=19456,t=2,p=1$AQIDBAUGBwgJCgsMDQ4PEA$6FdH2uU6BDX4fybSFF7lxJB41FXwyqCsxePTEBYjHDc";

    [Fact]
    public void relit_une_empreinte_de_l_application_actuelle()
    {
        PasswordHasher.Verify("Demo-TimeSheet-2026", FromNextJs).Should().BeTrue();
        PasswordHasher.Verify("mauvais", FromNextJs).Should().BeFalse();
    }

    [Fact]
    public void une_empreinte_neuve_se_verifie_et_change_a_chaque_fois()
    {
        var a = PasswordHasher.Hash("Reglages-2026-neuf");
        var b = PasswordHasher.Hash("Reglages-2026-neuf");
        a.Should().StartWith("$argon2id$v=19$m=19456,t=2,p=1$");
        a.Should().NotBe(b);
        PasswordHasher.Verify("Reglages-2026-neuf", a).Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("pas-une-empreinte")]
    [InlineData("$argon2i$v=19$m=19456,t=2,p=1$AQID$AQID")]
    [InlineData("$argon2id$v=19$m=x,t=2,p=1$AQID$AQID")]
    public void une_empreinte_mal_formee_vaut_un_refus(string encoded)
    {
        PasswordHasher.Verify("Demo-TimeSheet-2026", encoded).Should().BeFalse();
    }
}
